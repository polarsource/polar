import { createVoid, type Wire } from '@void/sdk'
import { ai, CHEAPER, config } from '../void'
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

export const customerSenses = async (): Promise<
  readonly Wire.CustomerSenseState[]
> => {
  try {
    return (
      (await withTimeout(void_.api.customers.state(ORG), 3_000)).senses ?? []
    )
  } catch {
    return []
  }
}

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
