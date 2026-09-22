import { included, product, recent, recurring, signal, usd } from '@void/sdk'
import { defineConfig } from '@void/sdk/config'
import {
  inCredits,
  llm,
  perCall,
  perThousand,
  vercelGateway,
} from '@void/sdk/plugins'
import { MODELS, POOL } from './src/constants'
import { events } from './src/db/events'

export { MODELS, POOL }

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
  classify: true,
})

export const team = product('po_bot_team', {
  name: 'Po Bot Team',
  description: '100,000 credits a month for the whole organization.',
  price: recurring({ interval: 'month', amount: usd(99) }),
  meters: [included(ai.credits, POOL, { limit: 'hard' })],
})

/**
 * Ordinary meter signal on the customer's remaining credits. The band sits
 * just under the grant so one conversation crosses it; a real plan would
 * put it near empty. Evaluated on the root, because that is the customer.
 */
export const creditsLow = signal('credits-low', {
  meter: ai.credits,
  field: 'remaining',
  enter: { below: POOL - 50 },
  exit: { atLeast: POOL - 20 },
})

/** Polar asks Jev about the agent's recent credit spend; the SDK latches the answer. */
export const retryStorm = signal('retry-storm', {
  meter: ai.credits,
  when: 'most recent spend is retries or loops, not progress',
  over: recent(1, 'hour'),
  enter: { above: 0.7 },
  exit: { below: 0.4 },
})

export const config = defineConfig({
  schema: { ai, team, creditsLow, retryStorm },
  eventStorage: [{ type: 'sqlite', connection: events }],
})
