import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, Option, Schema } from 'effect'

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
const Profile = Schema.Struct({ name: Schema.String, ...SavedLogin.fields })
const Store = Schema.Struct({
  activeProfile: Schema.NullOr(Schema.String),
  profiles: Schema.Array(Profile),
})
export type CredentialStore = typeof Store.Type

export const credentialsPath = () =>
  process.env.VOID_CREDENTIALS_FILE ??
  join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
    'void',
    'credentials.json',
  )

export const readStore = Effect.fn('cli.readStore')(function* () {
  const raw = yield* Effect.tryPromise({
    try: async () => {
      try {
        return await readFile(credentialsPath(), 'utf8')
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        )
          return undefined
        throw error
      }
    },
    catch: () =>
      new CredentialsError({
        message:
          'Could not read saved credentials. Check file permissions or supply --api-url and --token.',
      }),
  })
  if (raw === undefined) return { activeProfile: null, profiles: [] }
  return yield* Effect.try({
    try: (): CredentialStore => {
      const value: unknown = JSON.parse(raw)
      const store = Schema.decodeUnknownOption(Store)(value)
      if (Option.isSome(store)) return store.value
      const legacy = Option.getOrThrow(
        Schema.decodeUnknownOption(SavedLogin)(value),
      )
      return {
        activeProfile: 'default',
        profiles: [{ name: 'default', ...legacy }],
      }
    },
    catch: () =>
      new CredentialsError({
        message:
          'Saved credentials are invalid. Run void logout --all, then void login again.',
      }),
  })
})

export const writeStore = (store: CredentialStore) =>
  Effect.tryPromise({
    try: async () => {
      const path = credentialsPath()
      await mkdir(dirname(path), { recursive: true, mode: 0o700 })
      const temporary = `${path}.${randomUUID()}.tmp`
      try {
        await writeFile(temporary, JSON.stringify(store) + '\n', {
          mode: 0o600,
          flag: 'wx',
        })
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

export const removeStore = () =>
  Effect.tryPromise({
    try: () => rm(credentialsPath(), { force: true }),
    catch: () =>
      new CredentialsError({
        message: 'Could not remove saved credentials. Check file permissions.',
      }),
  })
