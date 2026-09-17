import { createVoid, type Wire } from '@void/sdk'
import { ai, config } from '../void'
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

export const agentModel = (agent: Agent) =>
  void_.as(agent.id).ai.model(agent.model)

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
