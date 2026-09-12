import type { Polar as PolarSDK } from '@polar-sh/sdk/2026-04'
import { Effect, Redacted } from 'effect'
import {
  AuthError,
  loginCommand,
  type ActiveOrganization,
  type OrganizationSelection,
  type PolarEnvironment,
  type Session,
} from '@/schemas/Auth'
import { Auth, type Credential } from '@/services/auth'
import { CLIConfig } from '@/services/config'
import { Credentials } from '@/services/credentials'
import { OAuth } from '@/services/oauth'
import { Organizations } from '@/services/organizations'
import { Polar } from '@/services/polar'
import {
  type SendError,
  Trigger,
  type TriggerError,
  type TriggerEvent,
  type TriggerRequest,
  type TriggerResult,
} from '@/services/trigger'

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
  environment: PolarEnvironment
  sessions: PolarEnvironment[]
  replaced: boolean
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
    environment: 'production',
    sessions: ['sandbox', 'production'],
    replaced: true,
    failure: undefined,
    resolutions: [],
    ...initial,
  }
  const auth = Auth.of({
    override: Effect.sync(() => state.credential.source === 'override'),
    environments: Effect.suspend(() =>
      state.failure
        ? Effect.fail(state.failure)
        : Effect.succeed(
            state.credential.source === 'override'
              ? [state.environment]
              : [...state.sessions],
          ),
    ),
    savedEnvironments: Effect.suspend(() =>
      state.failure
        ? Effect.fail(state.failure)
        : Effect.succeed([...state.sessions]),
    ),
    resolve: (environment, rejected) =>
      Effect.suspend(() => {
        state.resolutions.push({ environment, rejected })
        return state.failure
          ? Effect.fail(state.failure)
          : Effect.succeed(state.credential)
      }),
    login: () => Effect.sync(() => state.replaced),
    logout: (targets) =>
      Effect.sync(() => {
        const deleted = targets.filter((target) =>
          state.sessions.includes(target),
        )
        state.sessions = state.sessions.filter(
          (session) => !targets.includes(session),
        )
        return deleted
      }),
  })
  return { auth, state }
}

interface OrganizationsState {
  items: ActiveOrganization[]
  selected: OrganizationSelection | undefined
  failure: AuthError | undefined
}

export const fakeOrganizations = (
  initial: Partial<OrganizationsState> = {},
) => {
  const state: OrganizationsState = {
    items: [],
    selected: undefined,
    failure: undefined,
    ...initial,
  }
  const available = () =>
    state.failure ? Effect.fail(state.failure) : Effect.succeed(state.items)
  const organizations = Organizations.of({
    list: (environment) =>
      Effect.map(Effect.suspend(available), (items) =>
        items.filter((item) => item.environment === environment),
      ),
    listAll: Effect.suspend(available),
    selected: Effect.sync(() => state.selected),
    select: (selection) =>
      Effect.sync(() => {
        state.selected = selection
      }),
    resolve: (id) =>
      Effect.suspend(() => {
        const found = state.items.find((item) =>
          id
            ? item.id === id
            : item.id === state.selected?.id &&
              item.environment === state.selected.environment,
        )
        return found
          ? Effect.succeed(found)
          : Effect.fail(new AuthError({ message: 'No active organization.' }))
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
  activeOrganization: OrganizationSelection | undefined
  writes: number
}

export const fakeConfig = (activeOrganization?: OrganizationSelection) => {
  const state: ConfigState = { activeOrganization, writes: 0 }
  const config = CLIConfig.of({
    getActiveOrganization: Effect.sync(() => state.activeOrganization),
    setActiveOrganization: (selection) =>
      Effect.sync(() => {
        state.writes++
        state.activeOrganization = selection
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

interface TriggerState {
  events: TriggerEvent[]
  result: TriggerResult
  failure: SendError | undefined
  listFailure: TriggerError | undefined
  sent: Array<{ organization: ActiveOrganization; request: TriggerRequest }>
}

export const fakeTrigger = (initial: Partial<TriggerState> = {}) => {
  const state: TriggerState = {
    events: [],
    result: {
      webhookEventId: 'evt-1',
      event: 'order.created',
      delivered: true,
      payload: { type: 'order.created', data: { id: 'ord-1' } },
    },
    failure: undefined,
    listFailure: undefined,
    sent: [],
    ...initial,
  }
  const trigger = Trigger.of({
    listEvents: () =>
      Effect.suspend(() =>
        state.listFailure
          ? Effect.fail(state.listFailure)
          : Effect.succeed(state.events),
      ),
    send: (organization, request) =>
      Effect.suspend(() => {
        state.sent.push({ organization, request })
        return state.failure
          ? Effect.fail(state.failure)
          : Effect.succeed({ ...state.result, event: request.event })
      }),
  })
  return { trigger, state }
}
