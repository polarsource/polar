import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { Console, Effect, Redacted, Schema } from 'effect'
import open from 'open'
import { CredentialsError } from './credential-store'
import { callbackPage, type CallbackOutcome } from './callback-page'
import { aside, soft } from './style'

export const CALLBACK_PORT = 3334
const CALLBACK_PATH = '/oauth/callback'
export const redirectUrl = `http://127.0.0.1:${CALLBACK_PORT}${CALLBACK_PATH}`

const SCOPES = [
  'openid',
  'profile',
  'organizations:read',
  'void:read',
  'void:write',
]

export const CLIENT_IDS = {
  production: 'polar_ci_XjXQSSOPTGUtMFJccc9vYhb6kYiw7YZ2XdYPX3FVG1z',
  sandbox: 'polar_ci_5ITcpZLBKyOabQJNLHyIZREcPqTdCa5iDvQVD2AiHU1',
  local: 'polar_ci_7zZLPbfy8HPbtjZ9IEhU2XQIsl8ntM3nI1XKt4Ja7h1',
} as const

export const WELL_KNOWN_API = {
  production: 'https://api.polar.sh',
  sandbox: 'https://sandbox-api.polar.sh',
} as const

const WEB_BY_API: Record<string, string> = {
  [WELL_KNOWN_API.production]: 'https://polar.sh',
  [WELL_KNOWN_API.sandbox]: 'https://sandbox.polar.sh',
}

const CLIENT_BY_API: Record<string, string> = {
  [WELL_KNOWN_API.production]: CLIENT_IDS.production,
  [WELL_KNOWN_API.sandbox]: CLIENT_IDS.sandbox,
}

const isLoopback = (host: string) =>
  host === 'localhost' ||
  host.endsWith('.localhost') ||
  host === '[::1]' ||
  /^127\.\d+\.\d+\.\d+$/.test(host)

const isWorktreeApiPort = (port: string) => /^81\d{2}$/.test(port)

export const canonicalLoopbackApiUrl = (apiUrl: string) => {
  try {
    const url = new URL(apiUrl)
    if (!isLoopback(url.hostname)) return apiUrl
    if (url.port === '8000' || isWorktreeApiPort(url.port)) return apiUrl
    url.port = '8000'
    return url.origin
  } catch {
    return apiUrl
  }
}

const loopbackWebUrl = (apiUrl: string) => {
  const url = new URL(apiUrl)
  url.port = isWorktreeApiPort(url.port)
    ? String(Number(url.port) - 5000)
    : '3000'
  return url.origin
}

export interface OAuthTarget {
  readonly apiUrl: string
  readonly webUrl: string
  readonly clientId: string
}

export const resolveClientId = (apiUrl: string, clientId?: string) => {
  const host = new URL(apiUrl).hostname
  return (
    clientId ??
    process.env.VOID_OAUTH_CLIENT_ID ??
    CLIENT_BY_API[apiUrl] ??
    (isLoopback(host) ? CLIENT_IDS.local : undefined)
  )
}

export const resolveOAuthTarget = (
  apiUrl: string,
  webUrl?: string,
  clientId?: string,
): Effect.Effect<OAuthTarget, CredentialsError> => {
  const resolvedApi = canonicalLoopbackApiUrl(apiUrl)
  const host = new URL(resolvedApi).hostname
  const resolvedWeb =
    webUrl ??
    WEB_BY_API[resolvedApi] ??
    (isLoopback(host) ? loopbackWebUrl(resolvedApi) : undefined)
  const resolvedClient = resolveClientId(resolvedApi, clientId)
  if (resolvedWeb === undefined || resolvedClient === undefined)
    return Effect.fail(
      new CredentialsError({
        message:
          'Browser login needs --web-url and VOID_OAUTH_CLIENT_ID for this server, or pass --token.',
      }),
    )
  return Effect.succeed({
    apiUrl: resolvedApi,
    webUrl: resolvedWeb,
    clientId: resolvedClient,
  })
}

export interface OAuthSession {
  readonly accessToken: Redacted.Redacted<string>
  readonly refreshToken?: Redacted.Redacted<string>
  readonly expiresAt: number
  readonly scopes: ReadonlyArray<string>
}

const TokenResponse = Schema.Struct({
  access_token: Schema.NonEmptyString,
  refresh_token: Schema.optionalKey(Schema.NullOr(Schema.NonEmptyString)),
  expires_in: Schema.Number.check(Schema.isGreaterThan(0)),
  scope: Schema.optionalKey(Schema.String),
})

const tokenRequest = (apiUrl: string, body: URLSearchParams) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`${apiUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      return { status: response.status, text: await response.text() }
    },
    catch: () =>
      new CredentialsError({
        message:
          'OAuth network request failed. Try again; saved credentials were not changed.',
      }),
  })

export const exchange = (
  apiUrl: string,
  clientId: string,
  params: URLSearchParams,
  previous?: OAuthSession,
) =>
  Effect.gen(function* () {
    params.set('client_id', clientId)
    const response = yield* tokenRequest(apiUrl, params)
    if (response.status < 200 || response.status >= 300) {
      return yield* new CredentialsError({
        message:
          response.status === 400 || response.status === 401
            ? 'OAuth authorization rejected. Run void login again.'
            : `OAuth service unavailable (HTTP ${response.status}). Try again.`,
      })
    }
    const data = yield* Schema.decodeUnknownEffect(TokenResponse)(
      yield* Effect.try({
        try: () => JSON.parse(response.text) as unknown,
        catch: () =>
          new CredentialsError({ message: 'Invalid OAuth response.' }),
      }),
    ).pipe(
      Effect.mapError(
        () => new CredentialsError({ message: 'Invalid OAuth response.' }),
      ),
    )
    return {
      accessToken: Redacted.make(data.access_token),
      refreshToken: data.refresh_token
        ? Redacted.make(data.refresh_token)
        : previous?.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      scopes:
        data.scope === undefined
          ? (previous?.scopes ?? [])
          : data.scope.split(' ').filter(Boolean),
    }
  })

export const refreshSession = (
  apiUrl: string,
  clientId: string,
  session: OAuthSession,
) =>
  session.refreshToken
    ? exchange(
        apiUrl,
        clientId,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: Redacted.value(session.refreshToken),
        }),
        session,
      )
    : Effect.fail(
        new CredentialsError({
          message: 'Session cannot be refreshed. Run void login again.',
        }),
      )

export type CallbackResult =
  | { outcome: 'success'; code: string }
  | { outcome: Exclude<CallbackOutcome, 'success'>; message: string }

export const parseCallback = (
  url: URL,
  expectedState: string,
): CallbackResult => {
  if (url.searchParams.get('state') !== expectedState)
    return { outcome: 'invalid', message: 'Invalid OAuth callback state.' }
  if (url.searchParams.has('error'))
    return {
      outcome: 'denied',
      message: 'OAuth authorization was denied or canceled.',
    }
  const code = url.searchParams.get('code')
  return code
    ? { outcome: 'success', code }
    : {
        outcome: 'invalid',
        message: 'OAuth callback is missing its authorization code.',
      }
}

const waitForCode = (state: string, authorization: URL) =>
  Effect.tryPromise({
    try: () =>
      new Promise<string>((resolve, reject) => {
        const server = createServer()
        let completed = false
        const finish = (error: Error | undefined, code?: string) => {
          if (completed) return
          completed = true
          server.close()
          server.closeAllConnections()
          if (error || code === undefined) reject(error)
          else resolve(code)
        }
        server.on('request', (request, response) => {
          const url = new URL(request.url ?? '/', redirectUrl)
          if (url.pathname !== CALLBACK_PATH || request.method !== 'GET') {
            response.writeHead(404).end()
            return
          }
          const result = parseCallback(url, state)
          response
            .writeHead(result.outcome === 'invalid' ? 400 : 200, {
              'Content-Type': 'text/html; charset=utf-8',
            })
            .end(callbackPage(result.outcome))
          if (result.outcome === 'success') finish(undefined, result.code)
          else finish(new Error(result.message))
        })
        server.on('error', () =>
          finish(
            new Error(
              `Cannot start OAuth callback server on 127.0.0.1:${CALLBACK_PORT}. Check whether the port is occupied.`,
            ),
          ),
        )
        server.listen(CALLBACK_PORT, '127.0.0.1', () => {
          void open(authorization.toString()).catch(() => undefined)
        })
      }),
    catch: (cause) =>
      new CredentialsError({
        message: cause instanceof Error ? cause.message : String(cause),
      }),
  })

export const browserLogin = (target: OAuthTarget) =>
  Effect.gen(function* () {
    const state = randomBytes(32).toString('hex')
    const verifier = randomBytes(48).toString('base64url')
    const authorization = new URL(`${target.webUrl}/oauth2/authorize`)
    authorization.search = new URLSearchParams({
      client_id: target.clientId,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: SCOPES.join(' '),
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      prompt: 'consent',
      sub_type: 'organization',
    }).toString()
    yield* Console.log('')
    yield* Console.log(soft('Opening your browser to sign in...'))
    yield* Console.log(soft('If it does not open, visit:'))
    yield* Console.log(`    ${aside(authorization.toString())}`)
    yield* Console.log('')
    yield* Console.log(soft('Waiting for you to authorize the CLI...'))
    yield* Console.log('')
    const code = yield* waitForCode(state, authorization).pipe(
      Effect.timeout('5 minutes'),
      Effect.mapError((error) =>
        error instanceof CredentialsError
          ? error
          : new CredentialsError({
              message: 'OAuth login timed out. Try again.',
            }),
      ),
    )
    return yield* exchange(
      target.apiUrl,
      target.clientId,
      new URLSearchParams({
        grant_type: 'authorization_code',
        redirect_uri: redirectUrl,
        code,
        code_verifier: verifier,
      }),
    )
  })
