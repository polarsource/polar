import { generateConfig, type PolarConfig } from '@polar-sh/polar'
import { Effect } from 'effect'

export const FORMATS = ['ts', 'json'] as const
export type Format = (typeof FORMATS)[number]

export const TEMPLATES = ['empty', 'demo'] as const
export type Template = (typeof TEMPLATES)[number]

export const DEFAULT_FILES: Record<Format, string> = {
  ts: 'polar.config.ts',
  json: 'polar.config.json',
}

export const formatOf = (file: string): Format | undefined =>
  file.endsWith('.json') ? 'json' : file.endsWith('.ts') ? 'ts' : undefined

const documents: Record<Template, PolarConfig> = {
  empty: { meters: [], benefits: [], products: [] },
  demo: {
    meters: [
      {
        external_id: 'tool_calls',
        name: 'Tool calls',
        unit: 'scalar',
        filter: {
          conjunction: 'and',
          clauses: [{ property: 'name', operator: 'eq', value: 'tool_call' }],
        },
        aggregation: { func: 'count' },
      },
    ],
    benefits: [
      {
        type: 'meter_credit',
        external_id: 'included_tool_calls',
        description: 'Included tool calls',
        properties: { meter: 'tool_calls', units: 1000, rollover: false },
      },
    ],
    products: [
      {
        external_id: 'free',
        name: 'Free',
        recurring_interval: 'month',
        recurring_interval_count: 1,
        prices: [
          { amount_type: 'fixed', price_currency: 'usd', price_amount: 0 },
        ],
        benefits: [],
      },
      {
        external_id: 'pro',
        name: 'Pro',
        recurring_interval: 'month',
        recurring_interval_count: 1,
        prices: [
          { amount_type: 'fixed', price_currency: 'usd', price_amount: 2900 },
        ],
        benefits: ['included_tool_calls'],
      },
    ],
  },
}

export const renderTemplate = (format: Format, template: Template) =>
  format === 'ts'
    ? Effect.orDie(generateConfig(documents[template]))
    : Effect.succeed(`${JSON.stringify(documents[template], null, 2)}\n`)
