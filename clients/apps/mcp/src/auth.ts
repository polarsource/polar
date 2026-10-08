import { Cache, Context, Effect, Exit, Layer } from 'effect'
import { HttpClient, type HttpClientError } from 'effect/http'

const OAUTH_ACCESS_TOKEN_PREFIX = 'polar_at_'
const VALIDATION_TTL = '60 seconds'
const MAX_CACHED_TOKENS = 1_000

interface TokenValidation {
  readonly apiUrl: string
  readonly token: string
}

export class Auth extends Context.Service<
  Auth,
  {
    readonly isTokenValid: (
      apiUrl: string,
      token: string,
    ) => Effect.Effect<boolean, HttpClientError.HttpClientError>
  }
>()('mcp/Auth') {
  static readonly layer = Layer.effect(
    Auth,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      const validations = yield* Cache.makeWith(
        ({ apiUrl, token }: TokenValidation) =>
          client
            .get(`${apiUrl}/v1/oauth2/userinfo`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .pipe(Effect.map((response) => response.status)),
        {
          capacity: MAX_CACHED_TOKENS,
          timeToLive: (exit) =>
            Exit.isSuccess(exit) && exit.value >= 200 && exit.value < 300
              ? VALIDATION_TTL
              : 0,
        },
      )

      const isTokenValid = Effect.fn('Auth.isTokenValid')(function* (
        apiUrl: string,
        token: string,
      ) {
        if (!token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) {
          return true
        }
        return (yield* Cache.get(validations, { apiUrl, token })) !== 401
      })

      return Auth.of({ isTokenValid })
    }),
  )
}

export const getBearerToken = (request: Request) => {
  const [scheme, token] = request.headers.get('Authorization')?.split(' ') ?? []
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined
}

export const unauthorized = (
  resourceMetadataUrl: string,
  error?: 'invalid_token',
) =>
  Response.json(
    { error: error ?? 'unauthorized' },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"${error ? `, error="${error}"` : ''}`,
      },
    },
  )
