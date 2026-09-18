import { assert, it } from '@effect/vitest'
import {
  checksum,
  compile,
  defineConfig,
  event,
  meter,
  recent,
  signal,
  sum,
  toSource,
} from '../src/config'
import { llm, perToken, type Billing } from '../src/plugins'
import { usd, type ClassifyOptions } from '../src/config/schema'

const MODELS = ['anthropic/claude-sonnet'] as const
const BILLING = perToken({
  'anthropic/claude-sonnet': { input: usd(1), output: usd(2) },
  other: { input: usd(1), output: usd(2) },
}) satisfies Billing<(typeof MODELS)[number]>
const ai = (options: { classify?: ClassifyOptions } = {}) =>
  llm({
    key: 'po_bot',
    models: MODELS,
    billing: BILLING,
    capture: false,
    ...options,
  })

it('compiles the llm plugin classifier and leaves other configs unchanged', () => {
  const plain = defineConfig({ schema: { ai: ai() } })
  const labeled = defineConfig({ schema: { ai: ai({ classify: true }) } })
  const compiled = compile(labeled)
  assert.deepEqual(compiled.activities, [
    { slug: 'po_bot', event: 'po_bot.completion', group_by: 'call_id' },
  ])
  assert.equal('activities' in compile(plain), false)
  assert.notEqual(checksum(compiled), checksum(compile(plain)))
})

it('takes the span key from the classify options', () => {
  const ir = compile(
    defineConfig({ schema: { ai: ai({ classify: { span: 'trace_id' } }) } }),
  )
  assert.equal(ir.activities?.[0]?.group_by, 'trace_id')
  const source = toSource(ir)
  assert.include(source, "classify: { span: 'trace_id' }")
  assert.notInclude(source, 'activities(')
})

it('exposes the classifier on the plugin without a query', () => {
  const plugin = ai({ classify: true })
  assert.equal(plugin.activity?.kind, 'activity')
  assert.equal(plugin.activity?.event, plugin.completion)
  assert.equal(ai().activity, undefined)
})

it('compiles semantic signals into the IR and the checksum', () => {
  const completion = event<{ tokens: number }>('llm.completion')
  const tokens = meter('tokens', {
    reducer: sum(completion, 'tokens'),
    price: { amount: 0 },
  })
  const plain = defineConfig({ schema: { completion, tokens } })
  const judged = defineConfig({
    schema: {
      completion,
      tokens,
      storm: signal('retry-storm', {
        meter: tokens,
        when: 'most recent spend is retries or loops, not progress',
        enter: { above: 0.7 },
        exit: { below: 0.4 },
      }),
    },
  })
  const compiled = compile(judged)
  assert.notProperty(compiled, 'senses')
  assert.deepEqual(compiled.signals, [
    {
      slug: 'retry-storm',
      kind: 'semantic',
      meter: 'tokens',
      when: 'most recent spend is retries or loops, not progress',
      over: { amount: 1, unit: 'hour' },
      enter_above: 0.7,
      exit_below: 0.4,
    },
  ])
  assert.notEqual(checksum(compiled), checksum(compile(plain)))
  assert.deepEqual(judged.signals[0]?.definition, {
    kind: 'semantic',
    meter: tokens,
    when: 'most recent spend is retries or loops, not progress',
    over: { kind: 'window', amount: 1, unit: 'hour' },
    enter: { above: 0.7 },
    exit: { below: 0.4 },
  })
  assert.equal(judged.meters.length, 1)
})

it('rejects a semantic signal over a week or without a meter', () => {
  const completion = event<{ tokens: number }>('llm.completion')
  const tokens = meter('tokens', {
    reducer: sum(completion, 'tokens'),
    price: { amount: 0 },
  })
  assert.throws(
    () =>
      signal('too-long', {
        meter: tokens,
        when: 'anything',
        over: recent(8, 'day'),
        enter: { above: 0.7 },
        exit: { below: 0.4 },
      }),
    /7 days/,
  )
  assert.throws(
    () =>
      signal('inverted', {
        meter: tokens,
        when: 'anything',
        enter: { above: 0.3 },
        exit: { below: 0.4 },
      }),
    /thresholds/,
  )
})
