import { Polar as PolarSDK } from '@polar-sh/sdk'
import { Context, Effect, Layer, Redacted } from 'effect'
import { AuthError, loginCommand, type PolarEnvironment } from '../schemas/Auth'
import { Auth } from './auth'

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
      return new PolarSDK({
        server: environment,
        accessToken: Redacted.value(accessToken),
      })
    })

  const use = <A>(
    fn: (client: PolarSDK) => Promise<A>,
    environment: PolarEnvironment = 'sandbox',
  ) =>
    Effect.gen(function* () {
      const client = yield* getClient(environment)
      return yield* Effect.tryPromise({
        try: () => fn(client),
        catch: (error) => {
          const status =
            typeof error === 'object' && error !== null && 'statusCode' in error
              ? error.statusCode
              : undefined
          switch (status) {
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
        },
      })
    })

  return Polar.of({ getClient, use })
})

export const layer = Layer.effect(Polar, make)
