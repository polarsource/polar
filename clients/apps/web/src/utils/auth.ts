import { getServerURL } from '@/utils/api'
import { operations } from '@polar-sh/client'

export const getGitHubAuthorizeURL = (
  params: NonNullable<
    operations['integrations_github:integrations.github.authorize']['parameters']['query']
  >,
): string => {
  const searchParams = new URLSearchParams()
  if (params.payment_intent_id) {
    searchParams.set('payment_intent_id', params.payment_intent_id)
  }
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

export const getGitHubOrganizationInstallationURL = (
  organizationId: string,
  params: NonNullable<
    operations['integrations_github:redirect_to_organization_installation']['parameters']['query']
  >,
): string => {
  const searchParams = new URLSearchParams()
  if (params.return_to) {
    searchParams.set('return_to', params.return_to)
  }
  return `${getServerURL()}/v1/integrations/github/organizations/${
    organizationId
  }/installation?${searchParams}`
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
