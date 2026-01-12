import { getPublicServerURL } from '@/utils/api'
import { operations } from '@polar-sh/client'

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

export const getGitHubAuthorizeLinkURL = (
  params: NonNullable<
    operations['integrations_github:integrations_github_link:integrations.github.link.authorize']['parameters']['query']
  >,
): string => {
  const searchParams = new URLSearchParams()
  if (params.return_to) {
    searchParams.set('return_to', params.return_to)
  }
  return `${getPublicServerURL()}/v1/integrations/github/link/authorize?${searchParams}`
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

export const getGoogleAuthorizeLinkURL = (
  params: NonNullable<
    operations['integrations_google:integrations_google_link:integrations.google.link.authorize']['parameters']['query']
  >,
): string => {
  const searchParams = new URLSearchParams()
  if (params.return_to) {
    searchParams.set('return_to', params.return_to)
  }
  return `${getPublicServerURL()}/v1/integrations/google/link/authorize?${searchParams}`
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
