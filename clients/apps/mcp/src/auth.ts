import { Clock, Context, Effect, Layer, Schema } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/http'

const OAUTH_ACCESS_TOKEN_PREFIX = 'polar_at_'
const VALIDATION_TTL_MILLIS = 60_000
const MAX_CACHED_TOKENS = 1_000
// The first API version whose userinfo returns the token's resource.
const USERINFO_API_VERSION = '2027-01'

const UserInfo = Schema.Struct({
  resource: Schema.optionalKey(Schema.NullOr(Schema.String)),
})

// A token without a recorded resource predates RFC 8707 support, or its client
// didn't send one: accept it until every client binds its tokens.
const isIssuedFor = (tokenResource: string | null, resource: string) =>
  tokenResource === null || tokenResource === resource

export class AuthUnavailable extends Schema.TaggedError<AuthUnavailable>()(
  'AuthUnavailable',
  { cause: Schema.Defect() },
) {}

export class Auth extends Context.Service<
  Auth,
  {
    readonly isTokenValid: (
      apiUrl: string,
      token: string,
      resource: string,
    ) => Effect.Effect<boolean, AuthUnavailable>
  }
>()('mcp/Auth') {
  static readonly layer = Layer.effect(
    Auth,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      // Only settled validations are shared: workerd cancels a request that
      // waits on a lookup still in flight in another request as hung.
      // The token's recorded resource is cached, not the verdict, so the same
      // token is checked against whichever resource it is presented to.
      const validations = new Map<
        string,
        { validUntil: number; resource: string | null }
      >()

      const isTokenValid = Effect.fn('Auth.isTokenValid')(function* (
        apiUrl: string,
        token: string,
        resource: string,
      ) {
        if (!token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) {
          return true
        }
        const key = `${apiUrl} ${token}`
        const now = yield* Clock.currentTimeMillis
        const cached = validations.get(key)
        if (cached && cached.validUntil > now) {
          return isIssuedFor(cached.resource, resource)
        }
        const toAuthUnavailable = Effect.mapError(
          (cause) => new AuthUnavailable({ cause }),
        )
        const response = yield* client
          .get(`${apiUrl}/v1/oauth2/userinfo`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Polar-Version': USERINFO_API_VERSION,
            },
          })
          .pipe(toAuthUnavailable)
        if (response.status === 401) {
          return false
        }
        if (response.status < 200 || response.status >= 300) {
          return yield* new AuthUnavailable({
            cause: new Error(`userinfo returned ${response.status}`),
          })
        }
        const userInfo =
          yield* HttpClientResponse.schemaBodyJson(UserInfo)(response).pipe(
            toAuthUnavailable,
          )
        const tokenResource = userInfo.resource ?? null
        validations.delete(key)
        if (validations.size >= MAX_CACHED_TOKENS) {
          validations.delete(validations.keys().next().value!)
        }
        validations.set(key, {
          validUntil: now + VALIDATION_TTL_MILLIS,
          resource: tokenResource,
        })
        return isIssuedFor(tokenResource, resource)
      })

      return Auth.of({ isTokenValid })
    }),
  )
}

export const getBearerToken = (request: Request) => {
  const [scheme, token] = request.headers.get('Authorization')?.split(' ') ?? []
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined
}

export const authUnavailable = () =>
  Response.json({ error: 'temporarily_unavailable' }, { status: 503 })

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
