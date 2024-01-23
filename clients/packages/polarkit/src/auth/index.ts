import {
  IntegrationsApiIntegrationsDiscordBotAuthorizeRequest,
  IntegrationsApiIntegrationsGithubAuthorizeRequest,
  MagicLinkApiMagicLinkAuthenticateRequest,
} from '@polar-sh/sdk'
import { getServerURL } from '../api'

export const getGitHubAuthorizeURL = (
  params: IntegrationsApiIntegrationsGithubAuthorizeRequest,
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
  return `${getServerURL()}/api/v1/integrations/github/authorize?${searchParams}`
}

export const getMagicLinkAuthenticateURL = (
  params: MagicLinkApiMagicLinkAuthenticateRequest,
): string => {
  const searchParams = new URLSearchParams({ token: params.token })
  if (params.returnTo !== undefined) {
    searchParams.set('return_to', params.returnTo)
  }
  return `${getServerURL()}/api/v1/magic_link/authenticate?${searchParams}`
}

export const getUserDiscordAuthorizeURL = (
  params: IntegrationsApiIntegrationsGithubAuthorizeRequest,
): string => {
  const searchParams = new URLSearchParams()
  if (params.returnTo !== undefined) {
    searchParams.set('return_to', params.returnTo)
  }
  return `${getServerURL()}/api/v1/integrations/discord/user/authorize?${searchParams}`
}

export const getBotDiscordAuthorizeURL = (
  params: IntegrationsApiIntegrationsDiscordBotAuthorizeRequest,
): string => {
  const searchParams = new URLSearchParams()
  if (params.returnTo !== undefined) {
    searchParams.set('return_to', params.returnTo)
  }
  return `${getServerURL()}/api/v1/integrations/discord/bot/authorize?${searchParams}`
}
