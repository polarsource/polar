import { assert, it } from '@effect/vitest'
import {
  activities,
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
import { llm, perToken } from '../src/plugins'
import { usd } from '../src/config/schema'

it('compiles an opt-in classifier and leaves empty configs unchanged', () => {
  const completion = event('llm.completion')
  const plain = defineConfig({ schema: { completion } })
  const labeled = defineConfig({
    schema: {
      completion,
      agent: activities({ source: completion, span: 'call_id' }),
    },
  })
  const compiled = compile(labeled)
  assert.deepEqual(compiled.activities, [
    {
      slug: 'agent',
      event: 'llm.completion',
      group_by: 'call_id',
    },
  ])
  assert.equal('activities' in compile(plain), false)
})

it('reads the completion event from an llm plugin', () => {
  const ai = llm({
    models: ['anthropic/claude-sonnet'],
    billing: perToken({
      'anthropic/claude-sonnet': { input: usd(1), output: usd(2) },
      other: { input: usd(1), output: usd(2) },
    }),
    capture: false,
  })
  const config = defineConfig({
    schema: { ai, agent: activities({ source: ai }) },
  })
  assert.equal(compile(config).activities?.[0]?.event, 'llm.completion')
})

it('pulls the span key and omits the default', () => {
  const completion = event('llm.completion')
  const source = (span?: string) =>
    toSource(
      compile(
        defineConfig({
          schema: {
            completion,
            agent: activities({ source: completion, span }),
          },
        }),
      ),
    )
  assert.notInclude(source(), 'span:')
  assert.include(source('trace_id'), "span: 'trace_id'")
  assert.notInclude(source('trace_id'), 'groupBy')
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
