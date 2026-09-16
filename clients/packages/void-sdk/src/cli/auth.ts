import { Config, Console, Effect, Option, Redacted } from 'effect'
import { Argument, Command, Flag, Prompt } from 'effect/unstable/cli'
import { Api } from '../api/index'
import { readStore } from './credential-store'
import {
  activateProfile,
  apiFrom,
  type Credentials,
  CredentialsError,
  forgetLogin,
  normalizeApiUrl,
  removeLogin,
  resolveCredentials,
  saveLogin,
} from './credentials'
import { describeTarget } from './format'
import {
  browserLogin,
  canonicalLoopbackApiUrl,
  resolveOAuthTarget,
  WELL_KNOWN_API,
} from './oauth'
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
    Flag.withDescription(
      'Organization access token; skips the browser. Also VOID_TOKEN',
    ),
    Flag.withFallbackConfig(Config.redacted('VOID_TOKEN')),
    Flag.optional,
  ),
  profile: profileFlag,
}

const sandboxFlag = Flag.boolean('sandbox').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Use sandbox-api.polar.sh'),
)
const productionFlag = Flag.boolean('production').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Use api.polar.sh'),
)

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
  showTarget(credentials).pipe(Effect.provide(apiFrom(credentials)))

const chooseApiUrl = Effect.fn('cli.chooseApiUrl')(function* (
  apiUrl: string | undefined,
  sandbox: boolean,
  production: boolean,
  profile?: string,
) {
  if (sandbox && production)
    return yield* new CredentialsError({
      message: 'Pass either --sandbox or --production, not both.',
    })
  if ((sandbox || production) && apiUrl !== undefined)
    return yield* new CredentialsError({
      message:
        '--sandbox and --production cannot be combined with --api-url or VOID_API_URL.',
    })
  if (sandbox) return yield* normalizeApiUrl(WELL_KNOWN_API.sandbox)
  if (production) return yield* normalizeApiUrl(WELL_KNOWN_API.production)
  if (apiUrl !== undefined)
    return yield* normalizeApiUrl(canonicalLoopbackApiUrl(apiUrl))
  const store = yield* readStore()
  const saved = store.profiles.find(
    (entry) => entry.name === (profile ?? store.activeProfile),
  )?.apiUrl
  if (saved !== undefined)
    return yield* normalizeApiUrl(canonicalLoopbackApiUrl(saved))
  if (!process.stdin.isTTY)
    return yield* new CredentialsError({
      message:
        'Login needs --api-url, --sandbox, --production, or VOID_API_URL when not running in a terminal.',
    })
  const environment = yield* Prompt.select({
    message: 'Which Polar environment?',
    choices: [
      {
        title: 'Local',
        value: 'http://127.0.0.1:8000',
        description: '127.0.0.1:8000',
      },
      {
        title: 'Sandbox',
        value: WELL_KNOWN_API.sandbox,
        description: 'sandbox.polar.sh',
      },
      {
        title: 'Production',
        value: WELL_KNOWN_API.production,
        description: 'polar.sh',
      },
    ],
  })
  return yield* normalizeApiUrl(environment)
})

export const login = Command.make(
  'login',
  {
    ...authFlags,
    sandbox: sandboxFlag,
    production: productionFlag,
    webUrl: Flag.string('web-url').pipe(
      Flag.withDescription('Dashboard URL for browser login'),
      Flag.withFallbackConfig(Config.string('VOID_WEB_URL')),
      Flag.optional,
    ),
  },
  ({ apiUrl, token, profile, sandbox, production, webUrl }) =>
    Effect.gen(function* () {
      const name = Option.getOrUndefined(profile)
      const target = yield* chooseApiUrl(
        Option.getOrUndefined(apiUrl),
        sandbox,
        production,
        name,
      )
      const accessToken = Option.getOrUndefined(token)
      let credentials: Credentials
      if (accessToken !== undefined) {
        if (Redacted.value(accessToken).trim() === '')
          return yield* new CredentialsError({
            message: 'An organization access token is required.',
          })
        credentials = { apiUrl: target, token: accessToken }
      } else {
        if (!process.stdin.isTTY)
          return yield* new CredentialsError({
            message:
              'Login needs a terminal to open the browser, or pass --token / VOID_TOKEN.',
          })
        yield* forgetLogin(name, target)
        const oauth = yield* resolveOAuthTarget(
          target,
          Option.getOrUndefined(webUrl),
        )
        const session = yield* browserLogin(oauth)
        credentials = {
          apiUrl: target,
          token: session.accessToken,
          ...(session.refreshToken
            ? { refreshToken: session.refreshToken }
            : {}),
          expiresAt: session.expiresAt,
        }
      }
      const organization = yield* validate(credentials)
      const savedName = yield* saveLogin(credentials, organization, name)
      yield* Console.log(`Logged in. Active profile: ${savedName}`)
    }),
).pipe(
  Command.withDescription(
    'Sign in with the browser and save an organization profile',
  ),
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
