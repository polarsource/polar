import { Context, DateTime, Effect, Layer, Redacted, Semaphore } from 'effect'
import {
  AuthError,
  environments,
  loginCommand,
  type PolarEnvironment,
  type Session,
} from '@/schemas/Auth'
import { Credentials } from '@/services/credentials'
import { CLIConfig } from '@/services/config'
import { OAuth } from '@/services/oauth'

export interface Credential {
  accessToken: Redacted.Redacted<string>
  source: 'override' | 'keyring'
  session?: Session
}

export class Auth extends Context.Service<
  Auth,
  {
    resolve: (
      environment: PolarEnvironment,
      rejectedToken?: Redacted.Redacted<string>,
    ) => Effect.Effect<Credential, AuthError>
    login: (
      environment: PolarEnvironment,
      newSession: boolean,
    ) => Effect.Effect<boolean, AuthError>
    logout: (
      targets: ReadonlyArray<PolarEnvironment>,
    ) => Effect.Effect<PolarEnvironment[], AuthError>
    override: Effect.Effect<boolean>
    environments: Effect.Effect<PolarEnvironment[], AuthError>
  }
>()('Auth') {}

const isEnvironment = (value: string): value is PolarEnvironment =>
  (environments as readonly string[]).includes(value)

export const make = (
  tokenOverride: Effect.Effect<string | undefined> = Effect.sync(
    () => process.env['POLAR_ACCESS_TOKEN'],
  ),
  environmentOverride: Effect.Effect<string | undefined> = Effect.sync(
    () => process.env['POLAR_ENVIRONMENT'],
  ),
) =>
  Effect.gen(function* () {
    const store = yield* Credentials
    const config = yield* CLIConfig
    const oauth = yield* OAuth
    const locks = {
      sandbox: yield* Semaphore.make(1),
      production: yield* Semaphore.make(1),
    }
    const override = tokenOverride.pipe(
      Effect.map((token) => token !== undefined),
    )
    const overrideEnvironment = Effect.gen(function* () {
      const value = yield* environmentOverride
      if (value === undefined) return 'production' as const
      if (isEnvironment(value)) return value
      return yield* new AuthError({
        message: 'POLAR_ENVIRONMENT must be "sandbox" or "production".',
      })
    })
    const requireSavedMode = Effect.gen(function* () {
      if (yield* override)
        return yield* new AuthError({
          message: 'Unset POLAR_ACCESS_TOKEN to manage saved sessions.',
        })
    })
    const saved = (environment: PolarEnvironment) =>
      Effect.gen(function* () {
        const session = yield* store.read(environment)
        if (!session)
          return yield* new AuthError({
            message: `Not logged in to ${environment}. Run ${loginCommand(environment)}.`,
          })
        return session
      })
    const resolve = (
      environment: PolarEnvironment,
      rejectedToken?: Redacted.Redacted<string>,
    ) =>
      Effect.gen(function* () {
        const token = yield* tokenOverride
        if (token !== undefined) {
          if (!token.trim())
            return yield* new AuthError({
              message:
                'POLAR_ACCESS_TOKEN is empty. Supply a valid token or unset it.',
            })
          if (rejectedToken)
            return yield* new AuthError({
              message:
                'POLAR_ACCESS_TOKEN was rejected. Check its environment and permissions; no saved session was used.',
            })
          return {
            source: 'override' as const,
            accessToken: Redacted.make(token),
          }
        }
        return yield* locks[environment].withPermit(
          Effect.gen(function* () {
            let session = yield* saved(environment)
            const now = yield* DateTime.nowAsDate
            if (
              session.expiresAt <= now.getTime() + 30_000 ||
              (rejectedToken &&
                Redacted.value(rejectedToken) ===
                  Redacted.value(session.accessToken))
            ) {
              session = yield* oauth.refresh(environment, session)
              yield* store.write(environment, session)
            }
            return {
              source: 'keyring' as const,
              accessToken: session.accessToken,
              session,
            }
          }),
        )
      })
    return Auth.of({
      override,
      resolve,
      environments: Effect.gen(function* () {
        if (yield* override) return [yield* overrideEnvironment]
        const available: PolarEnvironment[] = []
        for (const environment of environments) {
          if (yield* store.read(environment)) available.push(environment)
        }
        return available
      }),
      login: (environment, newSession) =>
        Effect.gen(function* () {
          yield* requireSavedMode
          if (!newSession && (yield* store.read(environment))) {
            yield* resolve(environment)
            return false
          }
          const session = yield* oauth.login(environment)
          yield* locks[environment].withPermit(
            Effect.gen(function* () {
              yield* store.write(environment, session)
              const selection = yield* config.getActiveOrganization
              if (selection?.environment === environment) {
                yield* config.setActiveOrganization(undefined)
              }
            }),
          )
          return true
        }),
      logout: (targets) =>
        Effect.gen(function* () {
          const deleted: PolarEnvironment[] = []
          for (const environment of targets) {
            if (yield* locks[environment].withPermit(store.delete(environment)))
              deleted.push(environment)
          }
          const selection = yield* config.getActiveOrganization
          if (selection && targets.includes(selection.environment)) {
            yield* config.setActiveOrganization(undefined)
          }
          return deleted
        }),
    })
  })

export const layer = Layer.effect(Auth, make())
