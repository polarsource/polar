import { Clock, Context, Effect, Layer, Schema } from 'effect'
import { HttpClient } from 'effect/http'
import { isRecord } from './json'

// Organization access tokens can't call userinfo. Any endpoint that accepts
// them works: invalid tokens get a 401 there, valid ones without the
// endpoint's scope a 403.
const VALIDATION_PATHS: ReadonlyArray<readonly [string, string]> = [
  ['polar_at_', '/v1/oauth2/userinfo'],
  ['polar_oat_', '/v1/organizations/?limit=1'],
]
const VALIDATION_TTL_MILLIS = 60_000
const MAX_CACHED_TOKENS = 1_000

export class AuthUnavailable extends Schema.TaggedError<AuthUnavailable>()(
  'AuthUnavailable',
  { cause: Schema.Defect() },
) {}

export interface Caller {
  readonly account: string | undefined
}

const accountOf = (token: string, body: unknown) => {
  if (!isRecord(body)) {
    return undefined
  }
  if (token.startsWith('polar_oat_')) {
    const organization = Array.isArray(body.items) ? body.items[0] : undefined
    return isRecord(organization) && typeof organization.id === 'string'
      ? `organization:${organization.id}`
      : undefined
  }
  return typeof body.sub === 'string'
    ? `${token.startsWith('polar_at_o_') ? 'organization' : 'user'}:${body.sub}`
    : undefined
}

export class Auth extends Context.Service<
  Auth,
  {
    readonly authenticate: (
      apiUrl: string,
      token: string,
    ) => Effect.Effect<Caller | undefined, AuthUnavailable>
  }
>()('mcp/Auth') {
  static readonly layer = Layer.effect(
    Auth,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      // Only settled validations are shared: workerd cancels a request that
      // waits on a lookup still in flight in another request as hung.
      const validated = new Map<string, { until: number; caller: Caller }>()

      const authenticate = Effect.fn('Auth.authenticate')(function* (
        apiUrl: string,
        token: string,
      ) {
        const path = VALIDATION_PATHS.find(([prefix]) =>
          token.startsWith(prefix),
        )?.[1]
        if (!path) {
          return undefined
        }
        const key = `${apiUrl} ${token}`
        const now = yield* Clock.currentTimeMillis
        const cached = validated.get(key)
        if (cached && cached.until > now) {
          return cached.caller
        }
        const response = yield* client
          .get(`${apiUrl}${path}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .pipe(Effect.mapError((cause) => new AuthUnavailable({ cause })))
        const { status } = response
        if (status === 401) {
          return undefined
        }
        if (status !== 403 && (status < 200 || status >= 300)) {
          return yield* new AuthUnavailable({
            cause: new Error(`${path} returned ${status}`),
          })
        }
        const body =
          status === 403
            ? undefined
            : yield* response.json.pipe(Effect.orElseSucceed(() => undefined))
        const caller: Caller = { account: accountOf(token, body) }
        validated.delete(key)
        if (validated.size >= MAX_CACHED_TOKENS) {
          validated.delete(validated.keys().next().value!)
        }
        validated.set(key, { until: now + VALIDATION_TTL_MILLIS, caller })
        return caller
      })

      return Auth.of({ authenticate })
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
  scopes: string[],
  error?: 'invalid_token',
) =>
  Response.json(
    { error: error ?? 'unauthorized' },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}", scope="${scopes.join(' ')}"${error ? `, error="${error}"` : ''}`,
      },
    },
  )
