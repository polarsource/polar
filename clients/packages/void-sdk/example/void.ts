import {
  activities,
  count,
  defineConfig,
  event,
  included,
  meter,
  on,
  product,
  recent,
  recurring,
  signal,
  sum,
  usd,
} from '../src/index'
import { credits, llm, perToken } from '../src/plugins/index'

// A hand-written event and meter: crawl pages, bill bandwidth, count
// the ones that indexed. Plugins sit beside this, they do not replace it.
export const page = event<{
  bytes: number
  host: string
  status?: string
}>('sdk_demo.page')

export const bandwidth = meter('sdk_demo_bandwidth', {
  reducer: sum(page, 'bytes'),
  price: usd(0.00000008),
})

export const indexed = count('sdk_demo_indexed', on(page, { status: 'ok' }))

// Token billing priced per model. One completion event feeds a pair of
// meters per named model and a catch-all pair for every other model; the
// server routes each completion by its `model`. Model names stay metadata.
export const ai = llm({
  models: ['anthropic/claude-fable-5-1'],
  billing: perToken({
    'anthropic/claude-fable-5-1': {
      input: usd(0.000003),
      output: usd(0.000015),
    },
    other: { input: usd(0.000001), output: usd(0.000004) },
  }),
  key: 'sdk_demo_llm',
  capture: false,
})

// A prepaid pool the app debits at its own tariff. Grants come from `grant`
// here; an app with a purchase event would adopt its reducer via `grants`.
export const wallet = credits({ key: 'sdk_demo_credits', price: usd(0) })

// Plugin meters take product terms like any other: Fable input tokens have
// an allowance with overage billed past it; everything else is pay per use.
export const pro = product('sdk_demo_pro', {
  name: 'SDK demo Pro',
  description: 'Flat monthly fee, Fable tokens included.',
  price: recurring({ interval: 'month', amount: usd(49) }),
  meters: [
    included(ai.models['anthropic/claude-fable-5-1'].input, 100_000, {
      limit: 'soft',
    }),
    ai.models['anthropic/claude-fable-5-1'].output,
    ai.other.input,
    ai.other.output,
  ],
})

export const agent = activities({ source: ai, run: 'call_id' })

// A semantic signal: Polar asks Jev about this meter's recent events and the
// SDK latches the answer. The question never leaves the SDK.
export const retryStorm = signal('retry-storm', {
  meter: ai.models['anthropic/claude-fable-5-1'].output,
  when: 'most recent spend is retries or loops, not progress',
  over: recent(1, 'hour'),
  enter: { above: 0.7 },
  exit: { below: 0.4 },
})

export const config = defineConfig({
  schema: {
    page,
    bandwidth,
    indexed,
    ai,
    wallet,
    pro,
    agent,
    retryStorm,
  },
})
