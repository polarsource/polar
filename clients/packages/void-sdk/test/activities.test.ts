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
      agent: activities({
        source: completion,
        span: 'call_id',
        run: 'run_id',
      }),
    },
  })
  const compiled = compile(labeled)
  assert.deepEqual(compiled.activities, [
    {
      slug: 'agent',
      event: 'llm.completion',
      group_by: 'call_id',
      run_by: 'run_id',
      taxonomy: 'polar.agent/v1',
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
    schema: { ai, agent: activities({ source: ai, run: 'run_id' }) },
  })
  assert.equal(compile(config).activities?.[0]?.event, 'llm.completion')
})

it('pulls span and run, and omits the default span key', () => {
  const completion = event('llm.completion')
  const ir = compile(
    defineConfig({
      schema: {
        completion,
        agent: activities({ source: completion, run: 'trace_id' }),
      },
    }),
  )
  const source = toSource(ir)
  assert.include(source, "run: 'trace_id'")
  assert.notInclude(source, 'span:')
  assert.notInclude(source, 'groupBy')
  assert.notInclude(source, 'runBy')
})

it('keeps semantic signals out of the IR and the checksum', () => {
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
  assert.notProperty(compiled, 'signals')
  assert.deepEqual(compiled, compile(plain))
  assert.equal(checksum(compiled), checksum(compile(plain)))
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
