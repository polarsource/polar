import { Deferred, Effect } from 'effect'

/**
 * Share one in-flight call between callers that ask for the same thing at the
 * same time. Nothing is cached: once the call settles, the next one runs again.
 *
 * A single check fans out into organization, identity, and customer-state reads,
 * so a page that checks every identity in a tree would otherwise fetch the same
 * customer state once per identity.
 */
export const coalesce = <Args extends ReadonlyArray<unknown>, A, E>(
  method: (...args: Args) => Effect.Effect<A, E>,
): ((...args: Args) => Effect.Effect<A, E>) => {
  const inFlight = new Map<string, Deferred.Deferred<A, E>>()
  return (...args) =>
    Effect.gen(function* () {
      const key = JSON.stringify(args)
      const waiting = inFlight.get(key)
      if (waiting) return yield* Deferred.await(waiting)
      const deferred = yield* Deferred.make<A, E>()
      inFlight.set(key, deferred)
      const exit = yield* Effect.exit(method(...args))
      inFlight.delete(key)
      yield* Deferred.done(deferred, exit)
      return yield* exit
    })
}

/** Reads a scope query repeats on the way to one answer. Writes are never shared. */
export const coalescedReads: ReadonlySet<string> = new Set([
  'organizationsCurrent',
  'identitiesGet',
  'customersState',
])
