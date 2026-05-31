import { getPublicServerURL, getServerURL } from '@/utils/api'
import { Client, operations, schemas } from '@polar-sh/client'
import { redirect } from 'next/navigation'

export const getGitHubAuthorizeLoginURL = (
  params: NonNullable<
    operations['integrations_github:integrations_github_login:integrations.github.login.authorize']['parameters']['query']
  >,
): string => {
  const searchParams = new URLSearchParams()
  if (params.return_to) {
    searchParams.set('return_to', params.return_to)
  }
  if (params.attribution) {
    searchParams.set('attribution', params.attribution)
  }
  return `${getPublicServerURL()}/v1/integrations/github/login/authorize?${searchParams}`
}

export const getGitHubAuthorizeLinkURL = (return_to?: string): string => {
  const searchParams = new URLSearchParams()
  if (return_to) {
    searchParams.set('return_to', return_to)
  }
  return `${getPublicServerURL()}/v1/auth/github/link/authorize?${searchParams}`
}

export const getGoogleAuthorizeLoginURL = (
  params: NonNullable<
    operations['integrations_google:integrations_google_login:integrations.google.login.authorize']['parameters']['query']
  >,
): string => {
  const searchParams = new URLSearchParams()
  if (params.return_to) {
    searchParams.set('return_to', params.return_to)
  }
  if (params.attribution) {
    searchParams.set('attribution', params.attribution)
  }
  return `${getPublicServerURL()}/v1/integrations/google/login/authorize?${searchParams}`
}

export const getGoogleAuthorizeLinkURL = (return_to?: string): string => {
  const searchParams = new URLSearchParams()
  if (return_to) {
    searchParams.set('return_to', return_to)
  }
  return `${getPublicServerURL()}/v1/auth/google/link/authorize?${searchParams}`
}

export const getAppleAuthorizeURL = (
  params: NonNullable<
    operations['integrations_apple:integrations.apple.authorize']['parameters']['query']
  >,
): string => {
  const searchParams = new URLSearchParams()
  if (params.return_to) {
    searchParams.set('return_to', params.return_to)
  }
  if (params.attribution) {
    searchParams.set('attribution', params.attribution)
  }
  return `${getPublicServerURL()}/v1/integrations/apple/authorize?${searchParams}`
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
    redirect(`${getServerURL()}/v1/auth/complete`)
  }

  return authenticationSession
}
