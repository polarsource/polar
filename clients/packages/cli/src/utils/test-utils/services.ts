import type { Polar as PolarSDK } from '@polar-sh/sdk/2026-04'
import { Effect, Redacted } from 'effect'
import {
  AuthError,
  loginCommand,
  type ActiveOrganization,
  type PolarEnvironment,
  type Session,
} from '@/schemas/Auth'
import { Auth, type Credential } from '@/services/auth'
import { CLIConfig } from '@/services/config'
import { Credentials } from '@/services/credentials'
import { OAuth } from '@/services/oauth'
import { Organizations } from '@/services/organizations'
import { Polar } from '@/services/polar'

export const session = (
  accessToken = 'access',
  overrides: Partial<Session> = {},
): Session => ({
  version: 1,
  accessToken: Redacted.make(accessToken),
  refreshToken: Redacted.make('refresh'),
  expiresAt: Date.now() + 3600_000,
  scopes: ['organizations:read'],
  ...overrides,
})

export const keyringCredential = (accessToken = 'token'): Credential => ({
  accessToken: Redacted.make(accessToken),
  source: 'keyring',
})

export const overrideCredential = (accessToken = 'ci-token'): Credential => ({
  accessToken: Redacted.make(accessToken),
  source: 'override',
})

interface AuthState {
  credential: Credential
  replaced: boolean
  deleted: boolean
  failure: AuthError | undefined
  resolutions: Array<{
    environment: PolarEnvironment
    rejected: Redacted.Redacted<string> | undefined
  }>
}

export const fakeAuth = (
  initial: Partial<Omit<AuthState, 'resolutions'>> = {},
) => {
  const state: AuthState = {
    credential: keyringCredential(),
    replaced: true,
    deleted: true,
    failure: undefined,
    resolutions: [],
    ...initial,
  }
  const auth = Auth.of({
    override: Effect.sync(() => state.credential.source === 'override'),
    resolve: (environment, rejected) =>
      Effect.suspend(() => {
        state.resolutions.push({ environment, rejected })
        return state.failure
          ? Effect.fail(state.failure)
          : Effect.succeed(state.credential)
      }),
    login: () => Effect.sync(() => state.replaced),
    logout: () => Effect.sync(() => state.deleted),
  })
  return { auth, state }
}

interface OrganizationsState {
  items: ActiveOrganization[]
  selected: Partial<Record<PolarEnvironment, string>>
  failure: AuthError | undefined
}

export const fakeOrganizations = (
  initial: Partial<OrganizationsState> = {},
) => {
  const state: OrganizationsState = {
    items: [],
    selected: {},
    failure: undefined,
    ...initial,
  }
  const organizations = Organizations.of({
    list: () =>
      Effect.suspend(() =>
        state.failure
          ? Effect.fail(state.failure)
          : Effect.succeed(state.items),
      ),
    selected: (environment) => Effect.sync(() => state.selected[environment]),
    select: (environment, id) =>
      Effect.sync(() => {
        state.selected[environment] = id
      }),
    resolve: (environment, id) =>
      Effect.suspend(() => {
        const target = id ?? state.selected[environment]
        const found = state.items.find((item) => item.id === target)
        return found
          ? Effect.succeed(found)
          : Effect.fail(
              new AuthError({
                message: `No active organization for ${environment}.`,
              }),
            )
      }),
  })
  return { organizations, state }
}

interface CredentialsState {
  sessions: Partial<Record<PolarEnvironment, Session>>
  failure: AuthError | undefined
  reads: number
  writes: number
}

export const fakeCredentials = (
  sessions: CredentialsState['sessions'] = {},
) => {
  const state: CredentialsState = {
    sessions,
    failure: undefined,
    reads: 0,
    writes: 0,
  }
  const credentials = Credentials.of({
    read: (environment) =>
      Effect.suspend(() => {
        state.reads++
        return state.failure
          ? Effect.fail(state.failure)
          : Effect.succeed(state.sessions[environment])
      }),
    write: (environment, session) =>
      Effect.sync(() => {
        state.writes++
        state.sessions[environment] = session
      }),
    delete: (environment) =>
      Effect.sync(() => {
        const present = state.sessions[environment] !== undefined
        delete state.sessions[environment]
        return present
      }),
  })
  return { credentials, state }
}

interface ConfigState {
  activeOrganizations: Partial<Record<PolarEnvironment, string>>
  writes: number
}

export const fakeConfig = (
  activeOrganizations: ConfigState['activeOrganizations'] = {},
) => {
  const state: ConfigState = { activeOrganizations, writes: 0 }
  const config = CLIConfig.of({
    getActiveOrganization: (environment) =>
      Effect.sync(() => state.activeOrganizations[environment]),
    setActiveOrganization: (environment, id) =>
      Effect.sync(() => {
        state.writes++
        if (id === undefined) delete state.activeOrganizations[environment]
        else state.activeOrganizations[environment] = id
      }),
  })
  return { config, state }
}

interface OAuthState {
  session: Session
  failure: AuthError | undefined
  logins: number
  refreshes: number
}

export const fakeOAuth = (
  initial: Partial<Pick<OAuthState, 'session' | 'failure'>> = {},
) => {
  const state: OAuthState = {
    session: session('new-account'),
    failure: undefined,
    logins: 0,
    refreshes: 0,
    ...initial,
  }
  const oauth = OAuth.of({
    login: () =>
      Effect.suspend(() => {
        state.logins++
        return state.failure
          ? Effect.fail(state.failure)
          : Effect.succeed(state.session)
      }),
    refresh: (environment, previous) =>
      Effect.suspend(() => {
        state.refreshes++
        if (state.failure) return Effect.fail(state.failure)
        if (!previous.refreshToken) {
          return Effect.fail(
            new AuthError({
              message: `Session cannot be refreshed. Run ${loginCommand(environment)} --new-session.`,
            }),
          )
        }
        return Effect.succeed({
          ...previous,
          expiresAt: Date.now() + 3600_000,
          accessToken: Redacted.make('rotated'),
          refreshToken: Redacted.make('rotated-refresh'),
        })
      }),
  })
  return { oauth, state }
}

interface PolarState {
  requests: PolarEnvironment[]
}

export const fakePolar = (client: unknown) => {
  const state: PolarState = { requests: [] }
  const sdk = client as PolarSDK
  const polar = Polar.of({
    getClient: () => Effect.succeed(sdk),
    use: (fn, environment = 'sandbox') =>
      Effect.tryPromise({
        try: () => {
          state.requests.push(environment)
          return fn(sdk)
        },
        catch: (error) =>
          new AuthError({
            message: error instanceof Error ? error.message : String(error),
          }),
      }),
  })
  return { polar, state }
}
