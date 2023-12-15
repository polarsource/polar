import { IntegrationsApiIntegrationsGithubAuthorizeRequest } from '@polar-sh/sdk'
import { getServerURL } from '../api'

export const getGitHubAuthorizeURL = (
  params: IntegrationsApiIntegrationsGithubAuthorizeRequest,
): string => {
  const searchParams = new URLSearchParams()
  if (params.paymentIntentId !== undefined) {
    searchParams.set('payment_intent_id', params.paymentIntentId)
  }
  if (params.gotoUrl !== undefined) {
    searchParams.set('goto_url', params.gotoUrl)
  }
  if (params.userSignupType !== undefined) {
    searchParams.set('user_signup_type', params.userSignupType)
  }
  return `${getServerURL()}/api/v1/integrations/github/authorize?${searchParams}`
}
