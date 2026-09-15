import { Context, Effect, Exit, Fiber, Layer, Scope } from 'effect'

/**
 * Work a request starts but does not wait for, such as deleting confirmed
 * events from the buffer. Fibers run in a client-owned scope so `flush()` can
 * wait for them and `dispose()` interrupts what is left. Outcomes are
 * discarded: this work is never allowed to fail the request that started it.
 */
export class Background extends Context.Service<
  Background,
  {
    readonly fork: <A, E>(effect: Effect.Effect<A, E>) => Effect.Effect<void>
    /** Waits for running work, up to the timeout, then interrupts the rest. */
    readonly drain: (timeoutMs: number) => Effect.Effect<void>
    readonly close: Effect.Effect<void>
  }
>()('void/Background') {}

export const BackgroundLive = Layer.effect(Background)(
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const fibers = new Set<Fiber.Fiber<unknown, unknown>>()
    return {
      fork: (effect) =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkIn(Effect.ignore(effect), scope)
          fibers.add(fiber)
          fiber.addObserver(() => fibers.delete(fiber))
        }),
      drain: (timeoutMs) =>
        Effect.suspend(() => Fiber.awaitAll([...fibers])).pipe(
          Effect.timeoutOption(timeoutMs),
          Effect.andThen(Effect.suspend(() => Fiber.interruptAll([...fibers]))),
          Effect.ignore,
        ),
      close: Scope.close(scope, Exit.void),
    }
  }),
)
