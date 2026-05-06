import { refreshAsync } from 'expo-auth-session'
import { CLIENT_ID, discovery } from './oauthConfig'

export type SessionData = {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: number | null
}

type SetSession = (data: SessionData | null) => void

type RefresherState = {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  setSession: SetSession | null
}

const state: RefresherState = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  setSession: null,
}

let knownLifetimeMs: number | null = null

let inFlight: Promise<string | null> | null = null

const DEFAULT_LIFETIME_MS = 60_000
const MIN_REFRESH_MARGIN_MS = 1_000
const MAX_REFRESH_MARGIN_MS = 60_000

export function configureRefresher(next: {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  setSession: SetSession
}) {
  state.accessToken = next.accessToken
  state.refreshToken = next.refreshToken
  state.expiresAt = next.expiresAt
  state.setSession = next.setSession

  if (knownLifetimeMs === null && typeof next.expiresAt === 'number') {
    const remaining = next.expiresAt - Date.now()
    if (remaining > 0) {
      knownLifetimeMs = remaining
    }
  }
}

export function hasRefreshToken(): boolean {
  return !!state.refreshToken
}

export function getRefresherAccessToken(): string | null {
  return state.accessToken
}

function oauthTokenEndpointErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('params' in error)) {
    return undefined
  }
  const params = (error as { params?: unknown }).params
  if (typeof params !== 'object' || params === null || !('error' in params)) {
    return undefined
  }
  const code = (params as { error?: unknown }).error
  return typeof code === 'string' ? code : undefined
}

function shouldClearSessionAfterTokenRefreshFailure(error: unknown): boolean {
  const code = oauthTokenEndpointErrorCode(error)
  return (
    code === 'invalid_grant' ||
    code === 'invalid_client' ||
    code === 'unauthorized_client' ||
    code === 'unsupported_grant_type'
  )
}

export function isAccessTokenStale(): boolean {
  if (!state.refreshToken) return false
  if (typeof state.expiresAt !== 'number') return false
  const lifetime = knownLifetimeMs ?? DEFAULT_LIFETIME_MS
  const marginMs = Math.max(
    MIN_REFRESH_MARGIN_MS,
    Math.min(MAX_REFRESH_MARGIN_MS, Math.floor(lifetime / 3)),
  )
  return state.expiresAt - Date.now() < marginMs
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!state.refreshToken || !state.setSession) {
    return null
  }
  if (inFlight) {
    return inFlight
  }

  const currentRefreshToken = state.refreshToken

  inFlight = (async () => {
    try {
      const response = await refreshAsync(
        { clientId: CLIENT_ID, refreshToken: currentRefreshToken },
        discovery,
      )

      const next: SessionData = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken ?? currentRefreshToken,
        expiresAt:
          typeof response.expiresIn === 'number'
            ? Date.now() + response.expiresIn * 1000
            : null,
      }

      state.accessToken = next.accessToken
      state.refreshToken = next.refreshToken ?? null
      state.expiresAt = next.expiresAt ?? null

      if (typeof response.expiresIn === 'number') {
        knownLifetimeMs = response.expiresIn * 1000
      }

      state.setSession?.(next)
      return next.accessToken
    } catch (error) {
      if (!shouldClearSessionAfterTokenRefreshFailure(error)) {
        return null
      }
      state.accessToken = null
      state.refreshToken = null
      state.expiresAt = null
      knownLifetimeMs = null
      state.setSession?.(null)
      return null
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}
