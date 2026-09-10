import { Context, Effect, Layer, Schema } from 'effect'
import { AuthError, Session, type PolarEnvironment } from '@/schemas/Auth'

export class Credentials extends Context.Service<
  Credentials,
  {
    read: (
      environment: PolarEnvironment,
    ) => Effect.Effect<Session | undefined, AuthError>
    write: (
      environment: PolarEnvironment,
      session: Session,
    ) => Effect.Effect<void, AuthError>
    delete: (environment: PolarEnvironment) => Effect.Effect<boolean, AuthError>
  }
>()('Credentials') {}

export const layer = Layer.sync(Credentials, () => {
  const entry = (environment: PolarEnvironment) =>
    Effect.tryPromise({
      try: async () => {
        // Load lazily so a missing native keyring doesn't break commands that don't need it.
        const { AsyncEntry } = await import('@napi-rs/keyring')
        return new AsyncEntry('polar-cli', environment)
      },
      catch: () => unavailable(),
    })
  return Credentials.of({
    read: (environment) =>
      Effect.gen(function* () {
        const credentialEntry = yield* entry(environment)
        const value = yield* Effect.tryPromise({
          try: () => credentialEntry.getPassword(),
          catch: () => unavailable(),
        })
        if (value == null) return undefined
        return yield* Schema.decodeUnknownEffect(
          Schema.fromJsonString(Session),
        )(value).pipe(
          Effect.mapError(
            () =>
              new AuthError({
                message:
                  'Saved session is corrupt or unsupported. Run polar auth logout (with --production if needed), then log in again.',
              }),
          ),
        )
      }),
    write: (environment, session) =>
      Effect.gen(function* () {
        const value = yield* Schema.encodeEffect(
          Schema.fromJsonString(Session),
        )(session).pipe(
          Effect.mapError(
            () => new AuthError({ message: 'Unable to encode saved session.' }),
          ),
        )
        const credentialEntry = yield* entry(environment)
        yield* Effect.tryPromise({
          try: () => credentialEntry.setPassword(value),
          catch: () => unavailable(),
        })
      }),
    delete: (environment) =>
      Effect.gen(function* () {
        const credentialEntry = yield* entry(environment)
        return yield* Effect.tryPromise({
          try: () => credentialEntry.deleteCredential(),
          catch: () => unavailable(),
        })
      }),
  })
})

const unavailable = () =>
  new AuthError({
    message:
      'OS keyring unavailable or access denied. Unlock your keychain or configure Linux Secret Service. For headless use, supply POLAR_ACCESS_TOKEN. No credentials were written to a file.',
  })
