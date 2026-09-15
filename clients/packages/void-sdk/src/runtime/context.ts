import { AsyncLocalStorage } from 'node:async_hooks'
import type { Metadata } from '../config/schema'
import { VoidError } from '../errors'

/** The identity acting right now, plus tags on everything it records while in scope. */
export interface Ambient {
  readonly id: string
  readonly tags: Metadata
}

export const IDENTITY_HEADER = 'x-void-identity'
export type HeaderBag = Headers | Record<string, string | string[] | undefined>

export function identityFromHeaders(headers: HeaderBag): string {
  const value =
    headers instanceof Headers
      ? headers.get(IDENTITY_HEADER)
      : headers[IDENTITY_HEADER]
  const id = Array.isArray(value) ? value[0] : value
  if (!id) {
    throw new VoidError({
      reason: 'no_scope',
      message: `no ${IDENTITY_HEADER} header`,
    })
  }
  return id
}

/** Each client owns its context, including concurrent and nested runs. */
export function makeIdentityContext() {
  const ambient = new AsyncLocalStorage<Ambient>()
  return {
    get: () => ambient.getStore()?.id,
    /** Identity and tags in scope, or undefined outside any `run`. */
    ambient: () => ambient.getStore(),
    current: () => {
      const id = ambient.getStore()?.id
      if (id === undefined) {
        throw new VoidError({
          reason: 'no_scope',
          message: 'no identity in scope; call inside scope.run()',
        })
      }
      return id
    },
    /** Nested runs inherit the outer tags; the inner ones win on a clash. */
    run: <T>(
      id: string,
      fn: () => Promise<T> | T,
      tags: Metadata = {},
    ): Promise<T> => {
      const outer = ambient.getStore()
      const inherited = outer?.id === id ? outer.tags : {}
      return ambient.run({ id, tags: { ...inherited, ...tags } }, async () =>
        fn(),
      )
    },
    dispose: () => ambient.disable(),
  }
}

export type IdentityContext = ReturnType<typeof makeIdentityContext>
