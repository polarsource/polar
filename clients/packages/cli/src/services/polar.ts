import { Polar as PolarSDK } from '@polar-sh/sdk'
import { Context, Effect, Layer, Redacted } from 'effect'
import { AuthError, loginCommand, type PolarEnvironment } from '../schemas/Auth'
import { Auth } from './auth'

export class Polar extends Context.Service<
  Polar,
  {
    getClient: (
      environment?: PolarEnvironment,
    ) => Effect.Effect<PolarSDK, AuthError>
    use: <A>(
      fn: (client: PolarSDK) => Promise<A>,
      environment?: PolarEnvironment,
    ) => Effect.Effect<A, AuthError>
  }
>()('Polar') {}

export const layer = Layer.effect(
  Polar,
  Effect.gen(function* () {
    const auth = yield* Auth
    const getClient = (environment: PolarEnvironment = 'sandbox') =>
      auth.resolve(environment).pipe(
        Effect.map(
          ({ accessToken }) =>
            new PolarSDK({
              server: environment,
              accessToken: Redacted.value(accessToken),
            }),
        ),
      )
    return Polar.of({
      getClient,
      use: (fn, environment = 'sandbox') =>
        getClient(environment).pipe(
          Effect.flatMap((client) =>
            Effect.tryPromise({
              try: () => fn(client),
              catch: (error) => {
                const status =
                  typeof error === 'object' &&
                  error !== null &&
                  'statusCode' in error
                    ? error.statusCode
                    : undefined
                return new AuthError({
                  message:
                    status === 401
                      ? `Authentication rejected for ${environment}. Check POLAR_ACCESS_TOKEN or run ${loginCommand(environment)} --new-session.`
                      : status === 403
                        ? 'Access denied. Check the token permissions (organizations:read is required to list organizations).'
                        : status === 404
                          ? 'Organization is missing or inaccessible. Check --org or run polar auth org with the selected environment.'
                          : 'Polar API request failed. Check your connection and try again.',
                })
              },
            }),
          ),
        ),
    })
  }),
)
