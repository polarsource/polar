import { Effect, Redacted } from 'effect'
import type { VoidOrganization } from '../api/generated'
import {
  CredentialsError,
  readStore,
  removeStore,
  writeStore,
} from './credential-store'
export { CredentialsError, credentialsPath } from './credential-store'

export interface Credentials {
  readonly apiUrl: string
  readonly token: Redacted.Redacted<string>
  readonly organizationId?: string
  readonly profile?: string
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
    return {
      apiUrl: target,
      token: selectedToken,
      ...(token === undefined && saved
        ? { profile: saved.profile, organizationId: saved.organizationId }
        : {}),
    }
  },
)
