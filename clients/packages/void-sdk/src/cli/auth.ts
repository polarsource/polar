import { Config, Console, Effect, Option, Redacted } from 'effect'
import { Argument, Command, Flag, Prompt } from 'effect/unstable/cli'
import { Api } from '../api/index'
import { apiLayer } from '../api/layers'
import { readStore } from './credential-store'
import {
  activateProfile,
  type Credentials,
  CredentialsError,
  normalizeApiUrl,
  removeLogin,
  resolveCredentials,
  saveLogin,
} from './credentials'
import { describeTarget } from './format'
import { styleEnabled } from './style'

const profileFlag = Flag.string('profile').pipe(
  Flag.withDescription('Saved organization profile'),
  Flag.optional,
)
export const authFlags = {
  apiUrl: Flag.string('api-url').pipe(
    Flag.withDescription('Server URL'),
    Flag.withFallbackConfig(Config.string('VOID_API_URL')),
    Flag.optional,
  ),
  token: Flag.redacted('token').pipe(
    Flag.withDescription('Organization token'),
    Flag.withFallbackConfig(Config.redacted('VOID_TOKEN')),
    Flag.optional,
  ),
  profile: profileFlag,
}

export const showTarget = Effect.fn('cli.showTarget')(function* (
  credentials: Credentials,
) {
  const api = yield* Api
  const organization = yield* api.organizationsCurrent(undefined)
  if (
    credentials.organizationId !== undefined &&
    organization.id !== credentials.organizationId
  )
    return yield* new CredentialsError({
      message:
        'The token organization does not match the saved profile. Log in again before continuing.',
    })
  if (credentials.profile) yield* Console.log(`Profile: ${credentials.profile}`)
  yield* Console.log(
    describeTarget(
      organization.name,
      organization.slug,
      credentials.apiUrl,
      styleEnabled(),
    ),
  )
  yield* Console.log(`Organization ID: ${organization.id}`)
  return organization
})

const validate = (credentials: Credentials) =>
  showTarget(credentials).pipe(
    Effect.provide(
      apiLayer({
        apiUrl: credentials.apiUrl,
        token: Redacted.value(credentials.token),
      }),
    ),
  )

export const login = Command.make(
  'login',
  authFlags,
  ({ apiUrl, token, profile }) =>
    Effect.gen(function* () {
      const name = Option.getOrUndefined(profile)
      let url = Option.getOrUndefined(apiUrl)
      if (url === undefined) {
        const store = yield* readStore()
        url = store.profiles.find(
          (entry) => entry.name === (name ?? store.activeProfile),
        )?.apiUrl
      }
      if (url === undefined) {
        if (!process.stdin.isTTY)
          return yield* new CredentialsError({
            message:
              'Login needs --api-url or VOID_API_URL when not running in a terminal.',
          })
        url = yield* Prompt.text({ message: 'Polar server URL' })
      }
      const target = yield* normalizeApiUrl(url)
      let accessToken = Option.getOrUndefined(token)
      if (accessToken === undefined) {
        if (!process.stdin.isTTY)
          return yield* new CredentialsError({
            message:
              'Login needs --token or VOID_TOKEN when not running in a terminal.',
          })
        accessToken = yield* Prompt.password({
          message: 'Organization access token',
        })
      }
      if (Redacted.value(accessToken).trim() === '')
        return yield* new CredentialsError({
          message: 'An organization access token is required.',
        })
      const credentials = { apiUrl: target, token: accessToken }
      const organization = yield* validate(credentials)
      const savedName = yield* saveLogin(credentials, organization, name)
      yield* Console.log(`Logged in. Active profile: ${savedName}`)
    }),
).pipe(
  Command.withDescription('Validate an organization token and save a profile'),
)

export const whoami = Command.make(
  'whoami',
  authFlags,
  ({ apiUrl, token, profile }) =>
    Effect.gen(function* () {
      const credentials = yield* resolveCredentials(
        Option.getOrUndefined(apiUrl),
        Option.getOrUndefined(token),
        Option.getOrUndefined(profile),
      )
      yield* validate(credentials)
    }),
).pipe(
  Command.withDescription(
    'Verify and display the current organization and server',
  ),
)

export const profiles = Command.make('profiles', {}, () =>
  Effect.gen(function* () {
    const store = yield* readStore()
    if (store.profiles.length === 0) {
      yield* Console.log(
        'No saved profiles. Run void login to connect an organization.',
      )
      return
    }
    for (const entry of store.profiles)
      yield* Console.log(
        `${entry.name === store.activeProfile ? '*' : ' '} ${entry.name}  ${entry.organization.name} (${entry.organization.slug})  ${entry.apiUrl}`,
      )
    if (process.env.VOID_API_URL || process.env.VOID_TOKEN)
      yield* Console.log(
        'VOID_API_URL or VOID_TOKEN overrides the active profile for commands without --profile.',
      )
  }),
).pipe(
  Command.withDescription(
    'List saved organization profiles; * marks the active profile',
  ),
)

export const switchProfile = Command.make(
  'switch',
  {
    profile: Argument.string('profile').pipe(Argument.optional),
  },
  ({ profile }) =>
    Effect.gen(function* () {
      let name = Option.getOrUndefined(profile)
      if (name === undefined) {
        const store = yield* readStore()
        if (store.profiles.length === 0)
          return yield* new CredentialsError({
            message: 'No saved profiles. Run void login first.',
          })
        if (!process.stdin.isTTY)
          return yield* new CredentialsError({
            message: 'Specify a profile: void switch <profile>.',
          })
        name = yield* Prompt.select({
          message: 'Choose an organization profile',
          choices: store.profiles.map((entry) => ({
            title: `${entry.name} — ${entry.organization.name} (${entry.apiUrl})`,
            value: entry.name,
          })),
        })
      }
      const credentials = yield* resolveCredentials(undefined, undefined, name)
      yield* validate(credentials)
      yield* activateProfile(name)
      yield* Console.log(`Active profile: ${name}`)
      if (process.env.VOID_API_URL || process.env.VOID_TOKEN)
        yield* Console.log(
          'Unset VOID_API_URL and VOID_TOKEN to use this profile for subsequent commands.',
        )
    }),
).pipe(
  Command.withDescription('Verify and activate a saved organization profile'),
)

export const logout = Command.make(
  'logout',
  {
    profile: profileFlag,
    all: Flag.boolean('all').pipe(
      Flag.withDescription('Remove every saved profile'),
    ),
  },
  ({ profile, all }) =>
    Effect.gen(function* () {
      if (all && Option.isSome(profile))
        return yield* new CredentialsError({
          message: 'Choose --all or --profile, not both.',
        })
      yield* removeLogin(Option.getOrUndefined(profile), all)
      yield* Console.log(
        'Saved login removed. Tokens have not been revoked; environment tokens are unchanged.',
      )
    }),
).pipe(
  Command.withDescription(
    'Remove the active profile, a named profile, or all saved profiles',
  ),
)
