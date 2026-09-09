import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Context, Effect, Layer, Schema } from 'effect'
import { AuthError, Session, type PolarEnvironment } from '../schemas/Auth'

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

export const decodeSession = (value: string | null | undefined) =>
  Effect.gen(function* () {
    if (value == null) return undefined
    return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Session))(
      value,
    ).pipe(
      Effect.mapError(
        () =>
          new AuthError({
            message:
              'Saved session is corrupt or unsupported. Run polar auth logout (with --production if needed), then log in again.',
          }),
      ),
    )
  })

export const layer = Layer.sync(Credentials, () => {
  let warned = false
  const entry = (environment: PolarEnvironment) =>
    Effect.tryPromise({
      try: async () => {
        if (!warned) {
          warned = true
          if (existsSync(join(homedir(), '.polar', 'tokens.json'))) {
            console.warn(
              'Legacy ~/.polar/tokens.json is ignored and still contains plaintext credentials. Delete it and log in again with polar auth login.',
            )
          }
        }
        const { AsyncEntry } = await import('@napi-rs/keyring')
        return new AsyncEntry('polar-cli', environment)
      },
      catch: () => unavailable(),
    })
  return Credentials.of({
    read: (environment) =>
      entry(environment).pipe(
        Effect.flatMap((entry) =>
          Effect.tryPromise({
            try: () => entry.getPassword(),
            catch: () => unavailable(),
          }),
        ),
        Effect.flatMap(decodeSession),
      ),
    write: (environment, session) =>
      Schema.encodeEffect(Schema.fromJsonString(Session))(session).pipe(
        Effect.mapError(
          () => new AuthError({ message: 'Unable to encode saved session.' }),
        ),
        Effect.flatMap((value) =>
          entry(environment).pipe(
            Effect.flatMap((entry) =>
              Effect.tryPromise({
                try: () => entry.setPassword(value),
                catch: () => unavailable(),
              }),
            ),
          ),
        ),
      ),
    delete: (environment) =>
      entry(environment).pipe(
        Effect.flatMap((entry) =>
          Effect.tryPromise({
            try: () => entry.deleteCredential(),
            catch: () => unavailable(),
          }),
        ),
      ),
  })
})

const unavailable = () =>
  new AuthError({
    message:
      'OS keyring unavailable or access denied. Unlock your keychain or configure Linux Secret Service. For headless use, supply POLAR_ACCESS_TOKEN. No credentials were written to a file.',
  })
