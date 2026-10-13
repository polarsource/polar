import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { Context, DateTime, Effect, Layer, Redacted, Schema } from 'effect'
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http'
import open from 'open'
import { apiOverride, apiUrl, dashboardOverride } from '@/services/api'
import {
  AuthError,
  loginCommand,
  type PolarEnvironment,
  type Session,
} from '@/schemas/Auth'
import { callbackPage, type CallbackOutcome } from '@/utils/callback-page'

const CLIENT_IDS = {
  production: 'polar_ci_gBnJ_Yv_uSGm5mtoPa2cCA',
  sandbox: 'polar_ci_AHVAKf9SDOaffma2auRGMXR3H8jg9QBgOfW7s1hYgW9',
  local: 'polar_ci_local_cli',
} as const

const DASHBOARD_ORIGINS = {
  production: 'https://polar.sh',
  sandbox: 'https://sandbox.polar.sh',
  local: 'http://127.0.0.1:3000',
} as const

export const authorizationUrl = (environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const dashboard = yield* dashboardOverride
    if (dashboard) return new URL('/oauth2/authorize', dashboard)
    if (yield* apiOverride)
      return yield* new AuthError({
        message:
          'POLAR_API_URL is set, so login needs POLAR_DASHBOARD_URL too. Point it at the matching dashboard, e.g. http://127.0.0.1:3000.',
      })
    return new URL('/oauth2/authorize', DASHBOARD_ORIGINS[environment])
  })

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
  redirectUrl: 'http://127.0.0.1:3333/oauth/callback',
}

export type AnnounceAuthorization = (authorization: URL) => Effect.Effect<void>

export class OAuth extends Context.Service<
  OAuth,
  {
    login: (
      environment: PolarEnvironment,
      announce: AnnounceAuthorization,
    ) => Effect.Effect<Session, AuthError>
    refresh: (
      environment: PolarEnvironment,
      session: Session,
    ) => Effect.Effect<Session, AuthError>
  }
>()('OAuth') {}

const TokenResponse = Schema.Struct({
  access_token: Schema.NonEmptyString,
  refresh_token: Schema.optional(Schema.NullOr(Schema.NonEmptyString)),
  expires_in: Schema.Finite.check(Schema.isGreaterThan(0)),
})

export const exchange = (
  environment: PolarEnvironment,
  params: URLSearchParams,
  previous?: Session,
) =>
  Effect.gen(function* () {
    params.set('client_id', CLIENT_IDS[environment])
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
      scopes: [],
    }
  }).pipe(Effect.scoped)

type CallbackResult =
  | { outcome: 'success'; code: string }
  | { outcome: Exclude<CallbackOutcome, 'success'>; message: string }

const parseCallback = (url: URL, expectedState: string): CallbackResult => {
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

const login = (
  environment: PolarEnvironment,
  announce: AnnounceAuthorization,
) =>
  Effect.gen(function* () {
    const state = randomBytes(32).toString('hex')
    const verifier = randomBytes(48).toString('base64url')
    const authorization = yield* authorizationUrl(environment)
    authorization.search = new URLSearchParams({
      client_id: CLIENT_IDS[environment],
      redirect_uri: config.redirectUrl,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      sub_type: 'user',
    }).toString()
    yield* announce(authorization)
    const server = createServer()
    const code = yield* Effect.callback<string, AuthError>((resume) => {
      let completed = false
      const finish = (result: Effect.Effect<string, AuthError>) => {
        if (!completed) {
          completed = true
          resume(result)
        }
      }
      server.on('request', (request, response) => {
        const url = new URL(request.url ?? '/', config.redirectUrl)
        if (url.pathname !== '/oauth/callback' || request.method !== 'GET') {
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
      server.on('error', () =>
        finish(
          Effect.fail(
            new AuthError({
              message:
                'Cannot start OAuth callback server on 127.0.0.1:3333. Check whether the port is occupied.',
            }),
          ),
        ),
      )
      server.listen(3333, '127.0.0.1', () => {
        void open(authorization.toString())
          .then((child) => {
            child.on('error', () =>
              finish(
                Effect.fail(
                  new AuthError({
                    message: 'Could not open the browser for login.',
                  }),
                ),
              ),
            )
            child.on('exit', (code) => {
              if (code)
                finish(
                  Effect.fail(
                    new AuthError({
                      message: 'Could not open the browser for login.',
                    }),
                  ),
                )
            })
          })
          .catch(() =>
            finish(
              Effect.fail(
                new AuthError({
                  message: 'Could not open the browser for login.',
                }),
              ),
            ),
          )
      })
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          server.close()
          server.closeAllConnections()
        }),
      ),
      Effect.timeout('5 minutes'),
      Effect.mapError((error) =>
        error instanceof AuthError
          ? error
          : new AuthError({ message: 'OAuth login timed out. Try again.' }),
      ),
    )
    return yield* exchange(
      environment,
      new URLSearchParams({
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUrl,
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
      login: (environment, announce) =>
        login(environment, announce).pipe(
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
