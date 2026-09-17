import {
  createVoid,
  type SignalState,
  type SignalWindow,
  type Wire,
} from '@void/sdk'
import { ai, CHEAPER, config, retryStorm } from '../void'
import type { Agent } from './db/schema'

export { MODELS } from '../void'

export const void_ = createVoid(config, {
  apiUrl: process.env.VOID_API_URL ?? 'http://127.0.0.1:8000',
  token: process.env.VOID_TOKEN ?? '',
})

export const ORG = 'acme'

export const addMember = async (id: string, cap: number) => {
  const member = await void_.as(ORG).spawn(id)
  await member.cap(ai.credits, cap)
}

export const addAgent = (memberId: string, id: string) =>
  void_.as(memberId).spawn(id)

export const agentModel = async (agent: Agent) => {
  const model = await cheaperIfStorm(agent)
  return void_.as(agent.id).ai.model(model)
}

const cheaperIfStorm = async (agent: Agent) => {
  try {
    const storm = await void_.as(agent.id).signals.retryStorm.get()
    if (storm.status === 'active') return CHEAPER[agent.model] ?? agent.model
  } catch {
    // Polar has not judged this window yet; keep the agent's model.
  }
  return agent.model
}

export const credits = (identity: string) =>
  void_.as(identity).ai.credits.balance()

export type Credits = Awaited<ReturnType<typeof credits>>

export type Standing = Pick<Credits, 'usage' | 'credits' | 'remaining'>

export const standings = async (ids: readonly string[]) => {
  const all = await Promise.all(ids.map(credits))
  return new Map<string, Standing>(
    ids.map((id, i) => {
      const { usage, credits, remaining } = all[i]!
      return [id, { usage, credits, remaining }]
    }),
  )
}

export const completions = async (): Promise<readonly Wire.Event[]> => {
  const { items } = await void_.api.events.list({
    external_root_id: ORG,
    name: ai.completion.name,
    limit: 50,
  })
  return items
}

const EMPTY_ACTIVITIES: Wire.ActivityReport = {
  taxonomy: 'polar.agent/v1',
  window: {},
  totals: { cost: 0, labeled_cost: 0, unlabeled_cost: 0, pending_cost: 0 },
  by_activity: [],
  runs: [],
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
    return await withTimeout(void_.api.activities.list(), 3_000)
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

/** Polar re-asks Jev at most once a minute, so asking sooner cannot change the answer. */
const JUDGMENT_TTL_MS = 30_000
const judged = new Map<string, { at: number; state: AgentJudgment | null }>()

const judgeAgent = async (id: string): Promise<AgentJudgment | null> => {
  const cached = judged.get(id)
  if (cached && Date.now() - cached.at < JUDGMENT_TTL_MS) return cached.state
  let state: AgentJudgment | null = null
  try {
    const signal = await withTimeout(
      void_.as(id).signals.retryStorm.get(),
      3_000,
    )
    state = {
      identityId: signal.identityId,
      signal: signal.signal,
      when: retryStorm.definition.when,
      over: retryStorm.definition.over,
      status: signal.status,
      noul: signal.noul,
      events: signal.evidence?.events ?? 0,
    }
  } catch {
    // Keep the dashboard moving; the next frame asks again.
  }
  judged.set(id, { at: Date.now(), state })
  return state
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

const loadSpan = async (key: string) => {
  const cached = classified.get(key)
  if (cached && cached.activity !== 'pending') return cached
  try {
    const span = await void_.api.activities.span(key)
    classified.set(key, span)
    return span
  } catch {
    return cached ?? null
  }
}

export const spansFor = async (events: readonly Wire.Event[]) => {
  const keys = [...new Set(events.map(spanKey))]
  const loaded = await Promise.all(
    keys.map(async (key) => [key, await loadSpan(key)] as const),
  )
  return new Map(loaded)
}
