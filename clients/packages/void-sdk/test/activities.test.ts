import { assert, it } from '@effect/vitest'
import { activities, compile, defineConfig, event, toSource } from '../src/config'
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
