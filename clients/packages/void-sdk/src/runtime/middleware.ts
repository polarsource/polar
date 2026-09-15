import type { EnsureOptions, Scope } from './scope'
import type { SchemaModule } from '../config/config'
import type { Metadata } from '../config/schema'

export interface Middleware<Req, Res> {
  (req: Req, res: Res, next: (error?: unknown) => void): void
}

/**
 * Ensure the request identity before entering its context, forward failures
 * to next. `tags` land on everything captured during the request.
 */
export function makeMiddleware<M extends SchemaModule>(
  ensure: (id: string, options?: EnsureOptions) => Promise<Scope<M>>,
) {
  return <Req, Res>(
    resolve: (req: Req) => EnsureOptions & {
      identity: string
      tags?: Metadata
    },
  ): Middleware<Req, Res> =>
    (req, _res, next) => {
      Promise.resolve()
        .then(() => {
          const { identity, tags, ...options } = resolve(req)
          return ensure(identity, options).then((actor) => ({ actor, tags }))
        })
        .then(({ actor, tags }) => actor.run(() => next(), tags))
        .catch(next)
    }
}
