import type { Middleware } from '@polar-sh/client'
import {
  getRefresherAccessToken,
  hasRefreshToken,
  isAccessTokenStale,
  refreshAccessToken,
} from './refresher'

const isOAuthEndpoint = (url: string): boolean =>
  url.includes('/v1/oauth2/token') || url.includes('/v1/oauth2/revoke')

export const refreshMiddleware: Middleware = {
  onRequest: async ({ request }) => {
    if (isOAuthEndpoint(request.url)) return

    if (hasRefreshToken() && isAccessTokenStale()) {
      const newAccessToken = await refreshAccessToken()
      if (!newAccessToken) return

      const next = new Request(request)
      next.headers.set('Authorization', `Bearer ${newAccessToken}`)
      return next
    }

    const latestToken = getRefresherAccessToken()
    if (!latestToken) return

    const expected = `Bearer ${latestToken}`
    if (request.headers.get('Authorization') !== expected) {
      const next = new Request(request)
      next.headers.set('Authorization', expected)
      return next
    }
  },

  onResponse: async ({ request, response, options }) => {
    if (response.status !== 401) return
    if (isOAuthEndpoint(request.url)) return
    if (!hasRefreshToken()) return

    const newAccessToken = await refreshAccessToken()
    if (!newAccessToken) return

    const retry = new Request(request)
    retry.headers.set('Authorization', `Bearer ${newAccessToken}`)
    const retried: Body & ResponseInit = await options.fetch(retry)
    // openapi-fetch rejects anything that is not an instance of the global
    // Response, and expo/fetch returns its own implementation.
    if (retried instanceof Response) return retried
    const body =
      retried.status === 204 || retried.status === 205 || retried.status === 304
        ? null
        : await retried.arrayBuffer()
    return new Response(body, retried)
  },
}
