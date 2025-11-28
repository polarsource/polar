import { getServerURL } from '@/utils/api'
import { operations } from '@polar-sh/client'

export const getGitHubAuthorizeURL = (
  params: NonNullable<
    operations['integrations_github:integrations.github.authorize']['parameters']['query']
  >,
): string => {
  const searchParams = new URLSearchParams()
  if (params.return_to) {
    searchParams.set('return_to', params.return_to)
  }
  if (params.attribution) {
    searchParams.set('attribution', params.attribution)
  }
  return `${getServerURL()}/v1/integrations/github/authorize?${searchParams}`
}

export const getGoogleAuthorizeURL = (
  params: NonNullable<
    operations['integrations_google:integrations.google.authorize']['parameters']['query']
  >,
): string => {
  const searchParams = new URLSearchParams()
  if (params.return_to) {
    searchParams.set('return_to', params.return_to)
  }
  if (params.attribution) {
    searchParams.set('attribution', params.attribution)
  }
  return `${getServerURL()}/v1/integrations/google/authorize?${searchParams}`
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
  return `${getServerURL()}/v1/integrations/apple/authorize?${searchParams}`
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
  return `${getServerURL()}/v1/integrations/discord/bot/authorize?${searchParams}`
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
  return `${getServerURL()}/v1/integrations/github_repository_benefit/user/authorize?${searchParams}`
}
