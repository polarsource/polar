const OAUTH_ACCESS_TOKEN_PREFIX = 'polar_at_'
const VALIDATION_TTL_MS = 60_000
const MAX_CACHED_TOKENS = 1_000

const validatedUntil = new Map<string, number>()

export const getBearerToken = (request: Request) => {
  const [scheme, token] = request.headers.get('Authorization')?.split(' ') ?? []
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined
}

export const isTokenValid = async (apiUrl: string, token: string) => {
  if (!token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) {
    return true
  }

  const key = `${apiUrl} ${token}`
  const now = Date.now()
  if ((validatedUntil.get(key) ?? 0) > now) {
    return true
  }

  const response = await fetch(`${apiUrl}/v1/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 401) {
    return false
  }

  if (validatedUntil.size >= MAX_CACHED_TOKENS) {
    for (const [cachedKey, expiresAt] of validatedUntil) {
      if (expiresAt <= now) {
        validatedUntil.delete(cachedKey)
      }
    }
  }
  validatedUntil.set(key, now + VALIDATION_TTL_MS)
  return true
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
