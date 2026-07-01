import { getPublicServerURL } from '@/utils/api'
import { CONFIG } from '@/utils/config'
import { Client, operations, schemas } from '@polar-sh/client'
import { redirect } from 'next/navigation'

export type LoginMethod =
  | 'email_otp'
  | 'totp'
  | 'backup_codes'
  | 'apple'
  | 'github'
  | 'google'
  | 'sso'

export const getGitHubAuthorizeLoginURL = (): string => {
  return `${getPublicServerURL()}/v1/auth/github/authorize`
}

export const getGitHubAuthorizeLinkURL = (return_to?: string): string => {
  const searchParams = new URLSearchParams()
  if (return_to) {
    searchParams.set('return_to', return_to)
  }
  return `${getPublicServerURL()}/v1/auth/github/link/authorize?${searchParams}`
}

export const getGoogleAuthorizeLoginURL = (): string => {
  return `${getPublicServerURL()}/v1/auth/google/authorize`
}

export const getGoogleAuthorizeLinkURL = (return_to?: string): string => {
  const searchParams = new URLSearchParams()
  if (return_to) {
    searchParams.set('return_to', return_to)
  }
  return `${getPublicServerURL()}/v1/auth/google/link/authorize?${searchParams}`
}

export const getAppleAuthorizeURL = (): string => {
  return `${getPublicServerURL()}/v1/auth/apple/authorize`
}

export const getSSOCallbackURL = (organizationSlug: string): string => {
  return `${getPublicServerURL()}/v1/auth/${organizationSlug}/sso/callback`
}

export const getSSOLoginURL = (organizationSlug: string): string => {
  return `${CONFIG.FRONTEND_BASE_URL}/auth/sso/${organizationSlug}`
}

export const getSSOJwksURL = (): string => {
  return `${getPublicServerURL()}/.well-known/jwks.json`
}

export const getBotDiscordAuthorizeURL = (
  params: NonNullable<
    operations['integrations_discord:integrations.discord.bot_authorize']['parameters']['query']
  >,
): string => {
  const searchParams = new URLSearchParams()
  if (params.return_to) {
    searchParams.set('return_to', params.return_to)
  }
  return `${getPublicServerURL()}/v1/integrations/discord/bot/authorize?${searchParams}`
}

export const getGitHubRepositoryBenefitAuthorizeURL = (
  params: NonNullable<
    operations['integrations_github_repository_benefit:integrations.github_repository_benefit.user_authorize']['parameters']['query']
  >,
): string => {
  const searchParams = new URLSearchParams()
  if (params.return_to) {
    searchParams.set('return_to', params.return_to)
  }
  return `${getPublicServerURL()}/v1/integrations/github_repository_benefit/user/authorize?${searchParams}`
}

export const checkAuthenticationSession = async (
  api: Client,
): Promise<schemas['AuthenticationSession'] | null> => {
  const {
    error,
    data: authenticationSession,
    response,
  } = await api.GET('/v1/auth/status')

  // A 429 (rate limited) returns an empty body with no structured error. We
  // can't determine the auth session, so treat it as "no active session" and
  // let the page render the login form instead of throwing. This matters
  // because the proxy redirects a rate-limited user to /auth, so /auth itself
  // must not 500 on the same rate-limit.
  if (response.status === 429) {
    return null
  }

  // Any other unexpected non-OK response (e.g. 5xx) also has no structured
  // error object; surface it loudly.
  if (!response.ok && !error) {
    throw new Error(
      `Unexpected response from /v1/auth/status: ${response.status}`,
    )
  }

  if (error) {
    if (error.error !== 'InvalidAuthenticationSession') {
      throw new Error(`Failed to check authentication session: ${error.error}`)
    }
    return null
  }

  if (
    authenticationSession.identity_id &&
    authenticationSession.available_factors.length === 0
  ) {
    redirect(`${getPublicServerURL()}/v1/auth/complete`)
  }

  return authenticationSession
}

export const getAuthenticationSessionRedirectPath = (
  authenticationSession: schemas['AuthenticationSession'] | null,
): '/auth/totp' | '/auth/backup-codes' | null => {
  if (!authenticationSession) {
    return null
  }

  if (
    authenticationSession.available_factors.some(
      (factor) => factor.type === 'totp',
    )
  ) {
    return '/auth/totp'
  }

  if (
    authenticationSession.available_factors.some(
      (factor) => factor.type === 'backup_codes',
    )
  ) {
    return '/auth/backup-codes'
  }

  return null
}
