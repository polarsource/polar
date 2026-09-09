import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { Context, DateTime, Effect, Layer, Redacted, Schema } from 'effect'
import open from 'open'
import {
  AuthError,
  loginCommand,
  type PolarEnvironment,
  type Session,
} from '../schemas/Auth'
import * as settings from './oauth-config'

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
  refresh_token: Schema.optional(Schema.NonEmptyString),
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
      environment === 'production'
        ? settings.PRODUCTION_CLIENT_ID
        : settings.SANDBOX_CLIENT_ID,
    )
    const response = yield* Effect.tryPromise({
      try: (signal) =>
        fetch(
          environment === 'production'
            ? settings.PRODUCTION_TOKEN_URL
            : settings.SANDBOX_TOKEN_URL,
          {
            method: 'POST',
            body: params,
            signal,
          },
        ),
      catch: () =>
        new AuthError({
          message:
            'OAuth network request failed. Try again; the saved session was not changed.',
        }),
    })
    if (!response.ok) {
      return yield* new AuthError({
        message:
          response.status === 400 || response.status === 401
            ? `OAuth authorization rejected. Run ${loginCommand(environment)} --new-session.`
            : `OAuth service unavailable (HTTP ${response.status}). Try again.`,
      })
    }
    const data = yield* Effect.tryPromise({
      try: () => response.json() as Promise<unknown>,
      catch: () => new AuthError({ message: 'Invalid OAuth response.' }),
    }).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(TokenResponse)),
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
      organization: previous?.organization,
    }
  })

export const validateCallback = (url: URL, expectedState: string) => {
  if (url.searchParams.get('state') !== expectedState) {
    return Effect.fail(
      new AuthError({ message: 'Invalid OAuth callback state.' }),
    )
  }
  if (url.searchParams.has('error')) {
    return Effect.fail(
      new AuthError({ message: 'OAuth authorization was denied or canceled.' }),
    )
  }
  const code = url.searchParams.get('code')
  return code
    ? Effect.succeed(code)
    : Effect.fail(
        new AuthError({
          message: 'OAuth callback is missing its authorization code.',
        }),
      )
}

const login = (environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const state = randomBytes(32).toString('hex')
    const verifier = randomBytes(48).toString('base64url')
    const authorization = new URL(
      environment === 'production'
        ? settings.PRODUCTION_AUTHORIZATION_URL
        : settings.SANDBOX_AUTHORIZATION_URL,
    )
    authorization.search = new URLSearchParams({
      client_id:
        environment === 'production'
          ? settings.PRODUCTION_CLIENT_ID
          : settings.SANDBOX_CLIENT_ID,
      redirect_uri: settings.config.redirectUrl,
      response_type: 'code',
      scope: settings.config.scopes.join(' '),
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      sub_type: 'user',
    }).toString()
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
        const url = new URL(request.url ?? '/', settings.config.redirectUrl)
        if (url.pathname !== '/oauth/callback' || request.method !== 'GET') {
          response.writeHead(404).end()
          return
        }
        response
          .writeHead(200, { 'Content-Type': 'text/plain' })
          .end('Return to the Polar CLI to complete login.')
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
        redirect_uri: settings.config.redirectUrl,
        code,
        code_verifier: verifier,
      }),
    )
  })

export const layer = Layer.succeed(
  OAuth,
  OAuth.of({
    login,
    refresh: (environment, session) =>
      session.refreshToken
        ? exchange(
            environment,
            new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: Redacted.value(session.refreshToken),
            }),
            session,
          )
        : Effect.fail(
            new AuthError({
              message: `Session cannot be refreshed. Run ${loginCommand(environment)} --new-session.`,
            }),
          ),
  }),
)
