import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import {
  Console,
  Context,
  DateTime,
  Effect,
  Layer,
  Redacted,
  Schema,
} from 'effect'
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from 'effect/unstable/http'
import open from 'open'
import { apiUrl } from '@/services/api'
import {
  AuthError,
  loginCommand,
  type PolarEnvironment,
  type Session,
} from '@/schemas/Auth'
import { callbackPage, type CallbackOutcome } from '@/utils/callback-page'
import * as ui from '@/utils/ui'

const SANDBOX_CLIENT_ID = 'polar_ci_AHVAKf9SDOaffma2auRGMXR3H8jg9QBgOfW7s1hYgW9'
const PRODUCTION_CLIENT_ID = 'polar_ci_gBnJ_Yv_uSGm5mtoPa2cCA'

const SANDBOX_AUTHORIZATION_URL = 'https://sandbox.polar.sh/oauth2/authorize'
const PRODUCTION_AUTHORIZATION_URL = 'https://polar.sh/oauth2/authorize'

const config = {
  scopes: [
    'benefits:read',
    'benefits:write',
    'checkout_links:read',
    'checkout_links:write',
    'checkouts:read',
    'checkouts:write',
    'custom_fields:read',
    'custom_fields:write',
    'customer_meters:read',
    'customer_portal:read',
    'customer_portal:write',
    'customer_seats:read',
    'customer_seats:write',
    'customer_sessions:write',
    'customers:read',
    'customers:write',
    'discounts:read',
    'discounts:write',
    'disputes:read',
    'email',
    'events:read',
    'events:write',
    'files:read',
    'files:write',
    'license_keys:read',
    'license_keys:write',
    'member_sessions:write',
    'members:read',
    'members:write',
    'meters:read',
    'meters:write',
    'metrics:read',
    'metrics:write',
    'notification_recipients:read',
    'notification_recipients:write',
    'notifications:read',
    'notifications:write',
    'openid',
    'orders:read',
    'orders:write',
    'organization_access_tokens:read',
    'organization_access_tokens:write',
    'organizations:read',
    'organizations:write',
    'payments:read',
    'payouts:read',
    'payouts:write',
    'products:read',
    'products:write',
    'profile',
    'refunds:read',
    'refunds:write',
    'subscriptions:read',
    'subscriptions:write',
    'transactions:read',
    'transactions:write',
    'user:read',
    'user:write',
    'wallets:read',
    'wallets:write',
    'webhooks:read',
    'webhooks:write',
  ],
}

const CALLBACK_HOST = '127.0.0.1'
const CALLBACK_PATH = '/oauth/callback'
export const PREFERRED_CALLBACK_PORT = 3333

export const callbackUrl = (port: number) =>
  `http://${CALLBACK_HOST}:${port}${CALLBACK_PATH}`

const boundPort = (server: Server) => {
  const address = server.address()
  return address !== null && typeof address === 'object'
    ? address.port
    : undefined
}

export interface CallbackListener {
  port: number
  fallback: boolean
}

export const listenOnFreePort = (
  server: Server,
  preferredPort: number,
): Effect.Effect<CallbackListener, AuthError> =>
  Effect.callback<CallbackListener, AuthError>((resume) => {
    const fail = (message: string) =>
      resume(
        Effect.fail(
          new AuthError({
            message: `Cannot start the sign-in callback server on ${CALLBACK_HOST}: ${message}`,
          }),
        ),
      )
    const attempt = (port: number, fallback: boolean) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off('listening', onListening)
        if (error.code === 'EADDRINUSE' && !fallback) {
          attempt(0, true)
          return
        }
        fail(error.message)
      }
      const onListening = () => {
        server.off('error', onError)
        const port = boundPort(server)
        if (port === undefined) {
          fail('no TCP port was assigned')
          return
        }
        resume(Effect.succeed({ port, fallback }))
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port, CALLBACK_HOST)
    }
    attempt(preferredPort, false)
  })

export class OAuth extends Context.Service<
  OAuth,
  {
    login: (environment: PolarEnvironment) => Effect.Effect<Session, AuthError>
    refresh: (
      environment: PolarEnvironment,
      session: Session,
    ) => Effect.Effect<Session, AuthError>
  }
>()('OAuth') {}

const TokenResponse = Schema.Struct({
  access_token: Schema.NonEmptyString,
  refresh_token: Schema.optional(Schema.NullOr(Schema.NonEmptyString)),
  expires_in: Schema.Number.check(Schema.isGreaterThan(0)),
  scope: Schema.optional(Schema.String),
})

export const exchange = (
  environment: PolarEnvironment,
  params: URLSearchParams,
  previous?: Session,
) =>
  Effect.gen(function* () {
    params.set(
      'client_id',
      environment === 'production' ? PRODUCTION_CLIENT_ID : SANDBOX_CLIENT_ID,
    )
    const client = HttpClient.withScope(yield* HttpClient.HttpClient)
    const request = HttpClientRequest.post(
      yield* apiUrl(environment, '/oauth2/token'),
    ).pipe(HttpClientRequest.bodyUrlParams(params))
    const response = yield* client.execute(request).pipe(
      Effect.mapError(
        () =>
          new AuthError({
            message:
              'OAuth network request failed. Try again; the saved session was not changed.',
          }),
      ),
    )
    if (response.status < 200 || response.status >= 300) {
      return yield* new AuthError({
        message:
          response.status === 400 || response.status === 401
            ? `OAuth authorization rejected. Run ${loginCommand(environment)} --new-session.`
            : `OAuth service unavailable (HTTP ${response.status}). Try again.`,
      })
    }
    const data = yield* HttpClientResponse.schemaBodyJson(TokenResponse)(
      response,
    ).pipe(
      Effect.mapError(
        () => new AuthError({ message: 'Invalid OAuth response.' }),
      ),
    )
    const now = yield* DateTime.nowAsDate
    return {
      version: 1 as const,
      accessToken: Redacted.make(data.access_token),
      refreshToken: data.refresh_token
        ? Redacted.make(data.refresh_token)
        : previous?.refreshToken,
      expiresAt: now.getTime() + data.expires_in * 1000,
      scopes:
        data.scope === undefined
          ? (previous?.scopes ?? [])
          : data.scope.split(' ').filter(Boolean),
    }
  }).pipe(Effect.scoped)

export type CallbackResult =
  | { outcome: 'success'; code: string }
  | { outcome: Exclude<CallbackOutcome, 'success'>; message: string }

export const parseCallback = (
  url: URL,
  expectedState: string,
): CallbackResult => {
  if (url.searchParams.get('state') !== expectedState) {
    return { outcome: 'invalid', message: 'Invalid OAuth callback state.' }
  }
  if (url.searchParams.has('error')) {
    return {
      outcome: 'denied',
      message: 'OAuth authorization was denied or canceled.',
    }
  }
  const code = url.searchParams.get('code')
  return code
    ? { outcome: 'success', code }
    : {
        outcome: 'invalid',
        message: 'OAuth callback is missing its authorization code.',
      }
}

export const validateCallback = (url: URL, expectedState: string) => {
  const result = parseCallback(url, expectedState)
  return result.outcome === 'success'
    ? Effect.succeed(result.code)
    : Effect.fail(new AuthError({ message: result.message }))
}

const authorizationUrl = (
  environment: PolarEnvironment,
  redirectUrl: string,
  state: string,
  verifier: string,
) => {
  const authorization = new URL(
    environment === 'production'
      ? PRODUCTION_AUTHORIZATION_URL
      : SANDBOX_AUTHORIZATION_URL,
  )
  authorization.search = new URLSearchParams({
    client_id:
      environment === 'production' ? PRODUCTION_CLIENT_ID : SANDBOX_CLIENT_ID,
    redirect_uri: redirectUrl,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    sub_type: 'user',
  }).toString()
  return authorization
}

const browserFailure = Effect.fail(
  new AuthError({ message: 'Could not open the browser for login.' }),
)

const waitForCallback = (
  server: Server,
  redirectUrl: string,
  state: string,
  authorization: URL,
) =>
  Effect.callback<string, AuthError>((resume) => {
    let completed = false
    const finish = (result: Effect.Effect<string, AuthError>) => {
      if (!completed) {
        completed = true
        resume(result)
      }
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
      finish(validateCallback(url, state))
    })
    server.on('error', (error) =>
      finish(
        Effect.fail(
          new AuthError({
            message: `The sign-in callback server failed: ${error.message}`,
          }),
        ),
      ),
    )
    void open(authorization.toString())
      .then((child) => {
        child.on('error', () => finish(browserFailure))
        child.on('exit', (code) => {
          if (code) finish(browserFailure)
        })
      })
      .catch(() => finish(browserFailure))
  }).pipe(
    Effect.timeout('5 minutes'),
    Effect.mapError((error) =>
      error instanceof AuthError
        ? error
        : new AuthError({ message: 'OAuth login timed out. Try again.' }),
    ),
  )

const login = (environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const state = randomBytes(32).toString('hex')
    const verifier = randomBytes(48).toString('base64url')
    const server = createServer()
    const closeServer = Effect.sync(() => {
      server.close()
      server.closeAllConnections()
    })
    const { code, redirectUrl } = yield* Effect.gen(function* () {
      const listener = yield* listenOnFreePort(server, PREFERRED_CALLBACK_PORT)
      const redirectUrl = callbackUrl(listener.port)
      const authorization = authorizationUrl(
        environment,
        redirectUrl,
        state,
        verifier,
      )
      yield* Console.log(ui.blank)
      if (listener.fallback) {
        yield* Console.log(
          ui.step(
            `Port ${PREFERRED_CALLBACK_PORT} is busy, using port ${listener.port} for the sign-in callback instead`,
          ),
        )
      }
      yield* Console.log(
        ui.step(`Opening your browser to sign in to Polar ${environment}...`),
      )
      yield* Console.log(ui.step('If it does not open, visit:'))
      yield* Console.log(`    ${ui.cyan(authorization.toString())}`)
      yield* Console.log(ui.blank)
      yield* Console.log(ui.step('Waiting for you to authorize the CLI...'))
      yield* Console.log(ui.blank)
      const code = yield* waitForCallback(
        server,
        redirectUrl,
        state,
        authorization,
      )
      return { code, redirectUrl }
    }).pipe(Effect.ensuring(closeServer))
    return yield* exchange(
      environment,
      new URLSearchParams({
        grant_type: 'authorization_code',
        redirect_uri: redirectUrl,
        code,
        code_verifier: verifier,
      }),
    )
  })

export const layer = Layer.effect(
  OAuth,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    return OAuth.of({
      login: (environment) =>
        login(environment).pipe(
          Effect.provideService(HttpClient.HttpClient, client),
        ),
      refresh: (environment, session) =>
        session.refreshToken
          ? exchange(
              environment,
              new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: Redacted.value(session.refreshToken),
              }),
              session,
            ).pipe(Effect.provideService(HttpClient.HttpClient, client))
          : Effect.fail(
              new AuthError({
                message: `Session cannot be refreshed. Run ${loginCommand(environment)} --new-session.`,
              }),
            ),
    })
  }),
)
