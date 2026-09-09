import { Effect, Redacted } from 'effect'
import type { PolarEnvironment } from '../schemas/Auth'
import { Auth } from '../services/auth'

export type StreamFetch = (
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
) => Promise<Response>

export const authenticatedStreamFetch = (
  environment: PolarEnvironment,
  forward: StreamFetch = fetch,
) =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const runPromise = Effect.runPromiseWith(yield* Effect.context<never>())
    let retried = false
    const streamFetch: StreamFetch = async (input, init) => {
      const options = { signal: init?.signal ?? undefined }
      const credential = await runPromise(auth.resolve(environment), options)
      const request = (accessToken: Redacted.Redacted<string>) => {
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Bearer ${Redacted.value(accessToken)}`)
        return forward(input, { ...init, headers })
      }
      const response = await request(credential.accessToken)
      if (
        response.status !== 401 ||
        retried ||
        credential.source === 'override'
      )
        return response
      retried = true
      await response.body?.cancel()
      const refreshed = await runPromise(
        auth.resolve(environment, credential.accessToken),
        options,
      )
      return request(refreshed.accessToken)
    }
    return streamFetch
  })
