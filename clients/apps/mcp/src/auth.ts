import { Clock, Context, Effect, Layer } from 'effect'
import { HttpClient, type HttpClientError } from 'effect/http'

const OAUTH_ACCESS_TOKEN_PREFIX = 'polar_at_'
const VALIDATION_TTL_MILLIS = 60_000
const MAX_CACHED_TOKENS = 1_000

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
      // Only settled validations are shared: workerd cancels a request that
      // waits on a lookup still in flight in another request as hung.
      const validUntil = new Map<string, number>()

      const isTokenValid = Effect.fn('Auth.isTokenValid')(function* (
        apiUrl: string,
        token: string,
      ) {
        if (!token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) {
          return true
        }
        const key = `${apiUrl} ${token}`
        const now = yield* Clock.currentTimeMillis
        if ((validUntil.get(key) ?? 0) > now) {
          return true
        }
        const { status } = yield* client.get(`${apiUrl}/v1/oauth2/userinfo`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (status >= 200 && status < 300) {
          validUntil.delete(key)
          if (validUntil.size >= MAX_CACHED_TOKENS) {
            validUntil.delete(validUntil.keys().next().value!)
          }
          validUntil.set(key, now + VALIDATION_TTL_MILLIS)
        }
        return status !== 401
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
