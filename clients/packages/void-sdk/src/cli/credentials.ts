import { Effect, Redacted } from 'effect'
import type { VoidOrganization } from '../api/generated'
import { apiLayer } from '../api/layers'
import {
  CredentialsError,
  readStore,
  removeStore,
  writeStore,
} from './credential-store'
import { refreshSession, resolveClientId } from './oauth'
export { CredentialsError, credentialsPath } from './credential-store'

export interface Credentials {
  readonly apiUrl: string
  readonly token: Redacted.Redacted<string>
  readonly organizationId?: string
  readonly profile?: string
  readonly refreshToken?: Redacted.Redacted<string>
  readonly expiresAt?: number
}

export const normalizeApiUrl = (value: string) =>
  Effect.try({
    try: () => {
      const url = new URL(value)
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error('Invalid URL')
      return url.href.replace(/\/+$/, '')
    },
    catch: () =>
      new CredentialsError({
        message:
          'Server URL must use http or https without credentials, query parameters, or a fragment.',
      }),
  })

export const readLogin = Effect.fn('cli.readLogin')(function* (
  profile?: string,
) {
  const store = yield* readStore()
  const name = profile ?? store.activeProfile
  const saved = store.profiles.find((entry) => entry.name === name)
  if (!saved) {
    if (name !== null && name !== undefined)
      return yield* new CredentialsError({
        message: `No saved profile "${name}". Run void profiles or void login --profile ${name}.`,
      })
    return undefined
  }
  return {
    apiUrl: yield* normalizeApiUrl(saved.apiUrl),
    token: Redacted.make(saved.token),
    organizationId: saved.organization.id,
    profile: saved.name,
    ...(saved.refreshToken
      ? { refreshToken: Redacted.make(saved.refreshToken) }
      : {}),
    ...(saved.expiresAt !== undefined ? { expiresAt: saved.expiresAt } : {}),
  }
})

export const saveLogin = Effect.fn('cli.saveLogin')(function* (
  credentials: Credentials,
  organization: VoidOrganization,
  profile?: string,
) {
  const store = yield* readStore()
  const name =
    profile ?? `${organization.slug}@${new URL(credentials.apiUrl).host}`
  if (name.trim() === '')
    return yield* new CredentialsError({
      message: 'A profile name is required.',
    })
  const existing = store.profiles.find((entry) => entry.name === name)
  if (
    existing &&
    (existing.organization.id !== organization.id ||
      (yield* normalizeApiUrl(existing.apiUrl)) !== credentials.apiUrl)
  )
    return yield* new CredentialsError({
      message: `Profile "${name}" belongs to a different organization or server. Choose another profile name.`,
    })
  yield* writeStore({
    activeProfile: name,
    profiles: [
      ...store.profiles.filter((entry) => entry.name !== name),
      {
        name,
        apiUrl: credentials.apiUrl,
        token: Redacted.value(credentials.token),
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
        ...(credentials.refreshToken
          ? { refreshToken: Redacted.value(credentials.refreshToken) }
          : {}),
        ...(credentials.expiresAt !== undefined
          ? { expiresAt: credentials.expiresAt }
          : {}),
      },
    ],
  })
  return name
})

export const activateProfile = Effect.fn('cli.activateProfile')(function* (
  name: string,
) {
  const store = yield* readStore()
  if (!store.profiles.some((entry) => entry.name === name))
    return yield* new CredentialsError({
      message: `No saved profile "${name}".`,
    })
  yield* writeStore({ ...store, activeProfile: name })
})

export const updateProfileTokens = Effect.fn('cli.updateProfileTokens')(
  function* (name: string, credentials: Credentials) {
    const store = yield* readStore()
    const existing = store.profiles.find((entry) => entry.name === name)
    if (!existing)
      return yield* new CredentialsError({
        message: `No saved profile "${name}".`,
      })
    yield* writeStore({
      ...store,
      profiles: store.profiles.map((entry) =>
        entry.name === name
          ? {
              ...entry,
              token: Redacted.value(credentials.token),
              ...(credentials.refreshToken
                ? { refreshToken: Redacted.value(credentials.refreshToken) }
                : {}),
              ...(credentials.expiresAt !== undefined
                ? { expiresAt: credentials.expiresAt }
                : {}),
            }
          : entry,
      ),
    })
  },
)

export const removeLogin = Effect.fn('cli.removeLogin')(function* (
  profile?: string,
  all = false,
) {
  if (all) return yield* removeStore()
  const store = yield* readStore()
  const name = profile ?? store.activeProfile
  if (
    profile !== undefined &&
    !store.profiles.some((entry) => entry.name === profile)
  )
    return yield* new CredentialsError({
      message: `No saved profile "${profile}".`,
    })
  const profiles = store.profiles.filter((entry) => entry.name !== name)
  if (profiles.length === 0) return yield* removeStore()
  yield* writeStore({
    activeProfile: name === store.activeProfile ? null : store.activeProfile,
    profiles,
  })
})

export const apiFrom = (credentials: Credentials) =>
  apiLayer({
    apiUrl: credentials.apiUrl,
    token: Redacted.value(credentials.token),
    organizationId: credentials.organizationId,
  })

export const resolveCredentials = Effect.fn('cli.resolveCredentials')(
  function* (
    apiUrl: string | undefined,
    token: Redacted.Redacted<string> | undefined,
    profile?: string,
  ): Effect.fn.Return<Credentials, CredentialsError> {
    if (token !== undefined && Redacted.value(token).trim() === '')
      return yield* new CredentialsError({
        message: 'An organization access token is required.',
      })
    if (profile !== undefined && (apiUrl !== undefined || token !== undefined))
      return yield* new CredentialsError({
        message:
          '--profile cannot be combined with --api-url, --token, VOID_API_URL or VOID_TOKEN. Unset credential overrides to use a saved profile.',
      })
    if (apiUrl !== undefined && token !== undefined)
      return { apiUrl: yield* normalizeApiUrl(apiUrl), token }
    const saved = yield* readLogin(profile)
    const target =
      apiUrl === undefined ? saved?.apiUrl : yield* normalizeApiUrl(apiUrl)
    if (target === undefined)
      return yield* new CredentialsError({
        message:
          'No server URL. Run void login, void switch, or set VOID_API_URL.',
      })
    const selectedToken =
      token ?? (saved?.apiUrl === target ? saved.token : undefined)
    if (
      selectedToken === undefined ||
      Redacted.value(selectedToken).trim() === ''
    )
      return yield* new CredentialsError({
        message: 'No token for this server. Run void login or set VOID_TOKEN.',
      })
    let credentials: Credentials = {
      apiUrl: target,
      token: selectedToken,
      ...(token === undefined && saved
        ? {
            profile: saved.profile,
            organizationId: saved.organizationId,
            refreshToken: saved.refreshToken,
            expiresAt: saved.expiresAt,
          }
        : {}),
    }
    if (
      token === undefined &&
      credentials.refreshToken &&
      credentials.expiresAt !== undefined &&
      credentials.expiresAt <= Date.now() + 30_000
    ) {
      const clientId = resolveClientId(credentials.apiUrl)
      if (clientId === undefined)
        return yield* new CredentialsError({
          message: 'Session cannot be refreshed. Run void login again.',
        })
      const session = yield* refreshSession(credentials.apiUrl, clientId, {
        accessToken: credentials.token,
        refreshToken: credentials.refreshToken,
        expiresAt: credentials.expiresAt,
        scopes: [],
      })
      credentials = {
        ...credentials,
        token: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
      }
      if (saved?.profile) yield* updateProfileTokens(saved.profile, credentials)
    }
    return credentials
  },
)
