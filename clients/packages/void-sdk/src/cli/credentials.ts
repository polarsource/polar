import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Effect, Option, Redacted, Schema } from 'effect'
import type { VoidOrganization } from '../api/generated'

export class CredentialsError extends Schema.TaggedError<CredentialsError>()(
  'CredentialsError',
  { message: Schema.String },
) {}

const SavedLogin = Schema.Struct({
  apiUrl: Schema.String,
  token: Schema.String,
  organization: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    slug: Schema.String,
  }),
})

export interface Credentials {
  readonly apiUrl: string
  readonly token: Redacted.Redacted<string>
}

export const credentialsPath = () =>
  process.env.VOID_CREDENTIALS_FILE ??
  join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
    'void',
    'credentials.json',
  )

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
      ) {
        throw new Error('Invalid URL')
      }
      return url.href.replace(/\/+$/, '')
    },
    catch: () =>
      new CredentialsError({
        message:
          'Server URL must use http or https without credentials, query parameters, or a fragment.',
      }),
  })

const missing = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT'

export const readLogin = Effect.fn('cli.readLogin')(function* () {
  const raw = yield* Effect.tryPromise({
    try: async () => {
      try {
        return await readFile(credentialsPath(), 'utf8')
      } catch (error) {
        if (missing(error)) return undefined
        throw error
      }
    },
    catch: () =>
      new CredentialsError({
        message:
          'Could not read saved credentials. Check file permissions or supply --api-url and --token.',
      }),
  })
  if (raw === undefined) return undefined
  // Never include the raw file or schema issues in errors: they contain the token.
  const saved = yield* Effect.try({
    try: () =>
      Option.getOrThrow(
        Schema.decodeUnknownOption(SavedLogin)(JSON.parse(raw)),
      ),
    catch: () =>
      new CredentialsError({
        message:
          'Saved credentials are invalid. Run void logout, then void login again.',
      }),
  })
  return {
    apiUrl: yield* normalizeApiUrl(saved.apiUrl),
    token: Redacted.make(saved.token),
  }
})

export const saveLogin = (
  credentials: Credentials,
  organization: VoidOrganization,
) =>
  Effect.tryPromise({
    try: async () => {
      const path = credentialsPath()
      await mkdir(dirname(path), { recursive: true, mode: 0o700 })
      const temporary = `${path}.${randomUUID()}.tmp`
      try {
        await writeFile(
          temporary,
          JSON.stringify({
            apiUrl: credentials.apiUrl,
            token: Redacted.value(credentials.token),
            organization: {
              id: organization.id,
              name: organization.name,
              slug: organization.slug,
            },
          }) + '\n',
          { mode: 0o600, flag: 'wx' },
        )
        await rename(temporary, path)
      } finally {
        await rm(temporary, { force: true })
      }
    },
    catch: () =>
      new CredentialsError({
        message:
          'Could not save credentials. Check permissions on the credentials directory.',
      }),
  })

export const removeLogin = () =>
  Effect.tryPromise({
    try: () => rm(credentialsPath(), { force: true }),
    catch: () =>
      new CredentialsError({
        message: 'Could not remove saved credentials. Check file permissions.',
      }),
  })

/** Flags/env have already been resolved by the CLI; saved credentials are the fallback. */
export const resolveCredentials = Effect.fn('cli.resolveCredentials')(
  function* (
    apiUrl: string | undefined,
    token: Redacted.Redacted<string> | undefined,
  ) {
    if (token !== undefined && Redacted.value(token).trim() === '') {
      return yield* new CredentialsError({
        message: 'An organization access token is required.',
      })
    }
    if (apiUrl !== undefined && token !== undefined) {
      return { apiUrl: yield* normalizeApiUrl(apiUrl), token }
    }
    const saved = yield* readLogin()
    const target =
      apiUrl === undefined ? saved?.apiUrl : yield* normalizeApiUrl(apiUrl)
    if (target === undefined)
      return yield* new CredentialsError({
        message: 'No server URL. Run void login or set VOID_API_URL.',
      })
    const selectedToken =
      token ?? (saved?.apiUrl === target ? saved.token : undefined)
    if (
      selectedToken === undefined ||
      Redacted.value(selectedToken).trim() === ''
    ) {
      return yield* new CredentialsError({
        message: 'No token for this server. Run void login or set VOID_TOKEN.',
      })
    }
    return { apiUrl: target, token: selectedToken }
  },
)
