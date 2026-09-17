import { included, product, recurring, usd } from '@void/sdk'
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

export const config = defineConfig({
  schema: { ai, team },
  eventStorage: [{ type: 'sqlite', connection: events }],
})
