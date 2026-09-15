import { assert, it } from '@effect/vitest'
import { Effect, Exit } from 'effect'
import { coalesce } from '../src/api/coalesce'

it.live('concurrent identical calls share one run', () =>
  Effect.gen(function* () {
    let runs = 0
    const read = coalesce((id: string) =>
      Effect.sync(() => {
        runs++
        return `state:${id}`
      }).pipe(Effect.delay('10 millis')),
    )
    const results = yield* Effect.all(
      [read('a'), read('a'), read('b'), read('a')],
      { concurrency: 'unbounded' },
    )
    assert.deepStrictEqual(results, [
      'state:a',
      'state:a',
      'state:b',
      'state:a',
    ])
    assert.strictEqual(runs, 2)
  }),
)

it.live('sequential calls run again', () =>
  Effect.gen(function* () {
    let runs = 0
    const read = coalesce(() => Effect.sync(() => ++runs))
    assert.strictEqual(yield* read(), 1)
    assert.strictEqual(yield* read(), 2)
  }),
)

it.live('failures reach every waiter and clear the slot', () =>
  Effect.gen(function* () {
    let runs = 0
    const read = coalesce(() =>
      Effect.sync(() => {
        runs++
      }).pipe(Effect.delay('10 millis'), Effect.andThen(Effect.fail('boom'))),
    )
    const exits = yield* Effect.all(
      [Effect.exit(read()), Effect.exit(read())],
      {
        concurrency: 'unbounded',
      },
    )
    for (const exit of exits) assert.isTrue(Exit.isFailure(exit))
    assert.strictEqual(runs, 1)
    assert.isTrue(Exit.isFailure(yield* Effect.exit(read())))
    assert.strictEqual(runs, 2)
  }),
)
