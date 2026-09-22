import {
  createVoid,
  voidOptionsFromLogin,
  type BalanceResult,
  type SignalState,
  type SignalWindow,
  type VoidOptions,
  type Wire,
} from '@void/sdk'
import { ai, CHEAPER, config, creditsLow, retryStorm } from '../void'
import { ORG } from './constants'
import { db } from './db'
import { agents, members, type Agent } from './db/schema'

export { MODELS } from '../void'
export { ORG }

const clientOf = (options: VoidOptions) => createVoid(config, options)

let current:
  | {
      apiUrl: string
      token: string
      organizationId?: string
      client: ReturnType<typeof clientOf>
    }
  | undefined

export const getVoid = async () => {
  const options = await voidOptionsFromLogin()
  if (
    current &&
    current.apiUrl === options.apiUrl &&
    current.token === options.token &&
    current.organizationId === options.organizationId
  )
    return current.client
  current = { ...options, client: clientOf(options) }
  return current.client
}

/** Recreate local members and agents on the logged-in org if they are missing. */
export const ensureAppIdentities = async () => {
  const void_ = await getVoid()
  await void_.root(ORG)
  const [memberRows, agentRows] = await Promise.all([
    db.select().from(members),
    db.select().from(agents),
  ])
  await Promise.all(
    memberRows.map(async (member) => {
      const scope = await void_.ensure(member.id, { parent: ORG })
      await scope.cap(ai.credits, member.cap)
    }),
  )
  await Promise.all(
    agentRows.map((agent) =>
      void_.ensure(agent.id, { parent: agent.memberId }),
    ),
  )
}

export const addMember = async (id: string, cap: number) => {
  const member = await (await getVoid()).as(ORG).spawn(id)
  await member.cap(ai.credits, cap)
}

export const addAgent = async (memberId: string, id: string) =>
  (await getVoid()).as(memberId).spawn(id)

/** Below this many credits left anywhere up the chain, the gate runs for real. */
const GATE_HEADROOM = 1_000

export interface CallHooks {
  /** Run the agent's cheaper sibling; set from the cached retry-storm judgment. */
  readonly cheaper: boolean
  /** The tightest remaining balance up the agent's chain, null when unknown or unlimited. */
  readonly headroom: number | null
  onStart(): void
  onEnd(credits: number): void
}

/**
 * The agent's model, metered as the agent. The gate is skipped while the
 * cached standings show ample headroom, so a message does not pay three
 * round trips before its first token; near the cap the real check runs.
 */
export const agentModel = async (agent: Agent, hooks: CallHooks) => {
  const model = hooks.cheaper
    ? (CHEAPER[agent.model] ?? agent.model)
    : agent.model
  return (await getVoid()).as(agent.id).ai.model(model, {
    gate: 'off',
    allow: async (call) => {
      hooks.onStart()
      if (hooks.headroom !== null && hooks.headroom > GATE_HEADROOM) return true
      return (await call.check()).allowed
    },
    onEnd: ({ completion }) => hooks.onEnd(completion.credits ?? 0),
  })
}

export type Standing = Pick<BalanceResult, 'usage' | 'credits' | 'remaining'>

/** A meter signal as the dashboard shows it. No noul: the latch is the balance. */
export interface BalanceSignal {
  readonly signal: string
  readonly status: SignalState['status']
  readonly remaining: number | null
  readonly provisional: boolean
  readonly enterBelow: number
  readonly exitAtLeast: number
}

const unreadSignal = (): BalanceSignal => ({
  signal: creditsLow.key,
  status: 'unknown',
  remaining: null,
  provisional: false,
  enterBelow: creditsLow.definition.enter.below,
  exitAtLeast: creditsLow.definition.exit.atLeast,
})

export const orgSignal = async (): Promise<BalanceSignal> => {
  try {
    const state = await withTimeout(
      (await getVoid()).as(ORG).signals.creditsLow.get(),
      3_000,
    )
    return {
      ...unreadSignal(),
      status: state.status,
      remaining: state.balance?.remaining ?? null,
      provisional: state.provisional,
    }
  } catch {
    return unreadSignal()
  }
}

/** Every identity's standing from one snapshot of the organization's tree. */
export const standings = async (ids: readonly string[]) => {
  const all = await (await getVoid()).as(ORG).ai.credits.balances(ids)
  return new Map<string, Standing>(
    [...all].map(([id, row]) => [
      id,
      { usage: row.usage, credits: row.credits, remaining: row.remaining },
    ]),
  )
}

export const completions = async (): Promise<readonly Wire.Event[]> => {
  const { items } = await (
    await getVoid()
  ).api.events.list({
    external_root_id: ORG,
    name: ai.completion.name,
    limit: 50,
  })
  return items
}

const EMPTY_ACTIVITIES: Wire.ActivityReport = {
  window: {},
  totals: { cost: 0, labeled_cost: 0, unlabeled_cost: 0, pending_cost: 0 },
  by_activity: [],
}

const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ])

export const activityReport = async (): Promise<Wire.ActivityReport> => {
  try {
    return await withTimeout((await getVoid()).api.activities.list(), 3_000)
  } catch {
    return EMPTY_ACTIVITIES
  }
}

/** One agent's semantic signal as the dashboard shows it. Serializable for SSE. */
export interface AgentJudgment {
  readonly identityId: string
  readonly signal: string
  readonly when: string
  readonly over: SignalWindow
  readonly status: SignalState['status']
  readonly noul: number | null
  readonly events: number
}

const judgeAgent = async (id: string): Promise<AgentJudgment | null> => {
  try {
    const signal = await withTimeout(
      (await getVoid()).as(id).signals.retryStorm.get(),
      3_000,
    )
    return {
      identityId: signal.identityId,
      signal: signal.signal,
      when: retryStorm.definition.when,
      over: retryStorm.definition.over,
      status: signal.status,
      noul: signal.noul,
      events: signal.evidence?.events ?? 0,
    }
  } catch {
    // Polar has not judged this window yet; the next beat asks again.
    return null
  }
}

export const judgments = async (
  agentIds: readonly string[],
): Promise<readonly AgentJudgment[]> =>
  (await Promise.all(agentIds.map(judgeAgent))).filter(
    (state): state is AgentJudgment => state !== null,
  )

/** Same key the worker uses: `metadata.call_id`, else the event's `external_id`. */
export const spanKey = (event: Wire.Event) => {
  const callId = event.metadata.call_id
  return typeof callId === 'string' && callId !== ''
    ? callId
    : event.external_id
}

const classified = new Map<string, Wire.ActivitySpan>()

/** Jev usually answers within minutes; older pending spans stop costing a request a beat. */
const PENDING_WINDOW_MS = 15 * 60_000

const loadSpan = async (key: string, timestamp: string) => {
  const cached = classified.get(key)
  if (cached && cached.activity !== 'pending') return cached
  if (cached && Date.now() - Date.parse(timestamp) > PENDING_WINDOW_MS)
    return cached
  try {
    const span = await (await getVoid()).api.activities.span(key)
    classified.set(key, span)
    return span
  } catch {
    return cached ?? null
  }
}

export const spansFor = async (events: readonly Wire.Event[]) => {
  const newest = new Map<string, string>()
  for (const event of events) {
    const key = spanKey(event)
    const seen = newest.get(key)
    if (!seen || seen < event.timestamp) newest.set(key, event.timestamp)
  }
  const loaded = await Promise.all(
    [...newest].map(
      async ([key, timestamp]) =>
        [key, await loadSpan(key, timestamp)] as const,
    ),
  )
  return new Map(loaded)
}
