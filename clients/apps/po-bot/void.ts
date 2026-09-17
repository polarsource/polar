import {
  activities,
  included,
  product,
  recent,
  recurring,
  signal,
  usd,
} from '@void/sdk'
import { defineConfig } from '@void/sdk/config'
import {
  inCredits,
  llm,
  perCall,
  perThousand,
  vercelGateway,
} from '@void/sdk/plugins'
import { events } from './src/db/events'

export const MODELS = [
  'anthropic/claude-sonnet-5',
  'anthropic/claude-haiku-4-5',
  'openai/gpt-5',
  'openai/gpt-5-mini',
] as const

export const CHEAPER: Record<string, string> = {
  'anthropic/claude-sonnet-5': 'anthropic/claude-haiku-4-5',
  'openai/gpt-5': 'openai/gpt-5-mini',
}

export const ai = llm({
  key: 'po_bot',
  gateway: vercelGateway(),
  models: MODELS,
  billing: inCredits({
    rates: {
      'anthropic/claude-sonnet-5': perThousand({ input: 3, output: 15 }),
      'anthropic/claude-haiku-4-5': perThousand({ input: 1, output: 5 }),
      'openai/gpt-5': perThousand({ input: 1.25, output: 10 }),
      'openai/gpt-5-mini': perThousand({ input: 0.25, output: 2 }),
      other: perCall(5),
    },
    round: 'up',
  }),
  capture: false,
})

export const team = product('po_bot_team', {
  name: 'Po Bot Team',
  description: '100,000 credits a month for the whole organization.',
  price: recurring({ interval: 'month', amount: usd(99) }),
  meters: [included(ai.credits, 100_000, { limit: 'hard' })],
})

export const agent = activities({ source: ai, run: 'call_id' })

/** Polar asks Jev about the agent's recent credit spend; the SDK latches the answer. */
export const retryStorm = signal('retry-storm', {
  meter: ai.credits,
  when: 'most recent spend is retries or loops, not progress',
  over: recent(1, 'hour'),
  enter: { above: 0.7 },
  exit: { below: 0.4 },
})

export const config = defineConfig({
  schema: { ai, team, agent, retryStorm },
  eventStorage: [{ type: 'sqlite', connection: events }],
})
