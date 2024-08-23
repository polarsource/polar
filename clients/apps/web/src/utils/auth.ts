import { getServerURL } from '@/utils/api'
import {
  IntegrationsDiscordApiIntegrationsDiscordBotAuthorizeRequest,
  IntegrationsDiscordApiIntegrationsDiscordUserAuthorizeRequest,
  IntegrationsGithubApiIntegrationsGithubAuthorizeRequest,
  IntegrationsGithubApiRedirectToOrganizationInstallationRequest,
  IntegrationsGithubRepositoryBenefitApiIntegrationsGithubRepositoryBenefitUserAuthorizeRequest,
  IntegrationsGoogleApiIntegrationsGoogleAuthorizeRequest,
  MagicLinkApiMagicLinkAuthenticateRequest,
} from '@polar-sh/sdk'

export const getGitHubAuthorizeURL = (
  params: IntegrationsGithubApiIntegrationsGithubAuthorizeRequest,
): string => {
  const searchParams = new URLSearchParams()
  if (params.paymentIntentId !== undefined) {
    searchParams.set('payment_intent_id', params.paymentIntentId)
  }
  if (params.returnTo !== undefined) {
    searchParams.set('return_to', params.returnTo)
  }
  if (params.userSignupType !== undefined) {
    searchParams.set('user_signup_type', params.userSignupType)
  }
  return `${getServerURL()}/v1/integrations/github/authorize?${searchParams}`
}

export const getGoogleAuthorizeURL = (
  params: IntegrationsGoogleApiIntegrationsGoogleAuthorizeRequest,
): string => {
  const searchParams = new URLSearchParams()
  if (params.returnTo !== undefined) {
    searchParams.set('return_to', params.returnTo)
  }
  if (params.userSignupType !== undefined) {
    searchParams.set('user_signup_type', params.userSignupType)
  }
  return `${getServerURL()}/v1/integrations/google/authorize?${searchParams}`
}

export const getGitHubOrganizationInstallationURL = (
  params: IntegrationsGithubApiRedirectToOrganizationInstallationRequest,
): string => {
  const searchParams = new URLSearchParams()
  if (params.returnTo !== undefined) {
    searchParams.set('return_to', params.returnTo)
  }
  return `${getServerURL()}/v1/integrations/github/organizations/${
    params.id
  }/installation?${searchParams}`
}

export const getMagicLinkAuthenticateURL = (
  params: MagicLinkApiMagicLinkAuthenticateRequest,
): string => {
  const searchParams = new URLSearchParams({ token: params.token })
  if (params.returnTo !== undefined) {
    searchParams.set('return_to', params.returnTo)
  }
  return `${getServerURL()}/v1/magic_link/authenticate?${searchParams}`
}

export const getUserDiscordAuthorizeURL = (
  params: IntegrationsDiscordApiIntegrationsDiscordUserAuthorizeRequest,
): string => {
  const searchParams = new URLSearchParams()
  if (params.returnTo !== undefined) {
    searchParams.set('return_to', params.returnTo)
  }
  return `${getServerURL()}/v1/integrations/discord/user/authorize?${searchParams}`
}

export const getBotDiscordAuthorizeURL = (
  params: IntegrationsDiscordApiIntegrationsDiscordBotAuthorizeRequest,
): string => {
  const searchParams = new URLSearchParams()
  if (params.returnTo !== undefined) {
    searchParams.set('return_to', params.returnTo)
  }
  return `${getServerURL()}/v1/integrations/discord/bot/authorize?${searchParams}`
}

export const getGitHubRepositoryBenefitAuthorizeURL = (
  params: IntegrationsGithubRepositoryBenefitApiIntegrationsGithubRepositoryBenefitUserAuthorizeRequest,
): string => {
  const searchParams = new URLSearchParams()
  if (params.returnTo !== undefined) {
    searchParams.set('return_to', params.returnTo)
  }
  return `${getServerURL()}/v1/integrations/github_repository_benefit/user/authorize?${searchParams}`
}
