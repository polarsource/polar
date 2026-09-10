import { Effect, Exit, Scope } from 'effect'
import { HttpClient, HttpClientRequest } from 'effect/unstable/http'
import type { PolarEnvironment } from '@/schemas/Auth'
import { Auth } from '@/services/auth'

export const authenticatedClient = (environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const client = HttpClient.withScope(yield* HttpClient.HttpClient)
    let retried = false
    return HttpClient.transform(client, (_response, request) =>
      Effect.gen(function* () {
        const credential = yield* auth.resolve(environment)
        const requestScope = yield* Scope.fork(yield* Effect.scope)
        const response = yield* client
          .execute(
            HttpClientRequest.bearerToken(request, credential.accessToken),
          )
          .pipe(Effect.provideService(Scope.Scope, requestScope))
        if (
          response.status !== 401 ||
          retried ||
          credential.source === 'override'
        )
          return response
        retried = true
        yield* Scope.close(requestScope, Exit.void)
        const refreshed = yield* auth.resolve(
          environment,
          credential.accessToken,
        )
        return yield* client.execute(
          HttpClientRequest.bearerToken(request, refreshed.accessToken),
        )
      }),
    )
  })

export type ApiClient = Effect.Success<ReturnType<typeof authenticatedClient>>
