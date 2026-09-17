import { createPolar, type Polar as PolarSDK } from '@polar-sh/sdk/2026-04'
import { Context, Effect, Layer, Redacted } from 'effect'
import { AuthError, loginCommand, type PolarEnvironment } from '@/schemas/Auth'
import { apiOrigin } from '@/services/api'
import { Auth } from '@/services/auth'

export class Polar extends Context.Service<Polar, PolarImpl>()('Polar') {}

interface PolarImpl {
  getClient: (
    environment?: PolarEnvironment,
  ) => Effect.Effect<PolarSDK, AuthError>
  use: <A>(
    fn: (client: PolarSDK) => Promise<A>,
    environment?: PolarEnvironment,
  ) => Effect.Effect<A, AuthError>
}

export const make = Effect.gen(function* () {
  const auth = yield* Auth

  const getClient = (environment: PolarEnvironment = 'sandbox') =>
    Effect.gen(function* () {
      const { accessToken } = yield* auth.resolve(environment)
      const baseUrl = yield* apiOrigin(environment)
      return createPolar({
        environment,
        baseUrl,
        accessToken: Redacted.value(accessToken),
      })
    })

  const use = <A>(
    fn: (client: PolarSDK) => Promise<A>,
    environment: PolarEnvironment = 'sandbox',
  ) =>
    Effect.gen(function* () {
      const credential = yield* auth.resolve(environment)
      const baseUrl = yield* apiOrigin(environment)
      const request = (accessToken: Redacted.Redacted<string>) =>
        Effect.tryPromise({
          try: () =>
            fn(
              createPolar({
                environment,
                baseUrl,
                accessToken: Redacted.value(accessToken),
              }),
            ),
          catch: (error) => ({
            statusCode:
              typeof error === 'object' &&
              error !== null &&
              'statusCode' in error
                ? error.statusCode
                : undefined,
          }),
        })

      return yield* request(credential.accessToken).pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            if (credential.source !== 'keyring' || error.statusCode !== 401)
              return yield* Effect.fail(error)

            const refreshed = yield* auth.resolve(
              environment,
              credential.accessToken,
            )
            return yield* request(refreshed.accessToken)
          }),
        ),
        Effect.mapError((error) => {
          if (error instanceof AuthError) return error
          switch (error.statusCode) {
            case 401:
              return new AuthError({
                message: `Authentication rejected for ${environment}. Check POLAR_ACCESS_TOKEN or run ${loginCommand(environment)} --new-session.`,
              })
            case 403:
              return new AuthError({
                message:
                  'Access denied. Check the token permissions (organizations:read is required to list organizations).',
              })
            case 404:
              return new AuthError({
                message:
                  'Organization is missing or inaccessible. Check --org or run polar auth org with the selected environment.',
              })
            default:
              return new AuthError({
                message:
                  'Polar API request failed. Check your connection and try again.',
              })
          }
        }),
      )
    })

  return Polar.of({ getClient, use })
})

export const layer = Layer.effect(Polar, make)
