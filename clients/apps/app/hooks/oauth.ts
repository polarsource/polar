import { useSession } from '@/providers/SessionProvider'
import {
  exchangeCodeAsync,
  makeRedirectUri,
  useAuthRequest,
} from 'expo-auth-session'
import * as Sentry from '@sentry/react-native'
import * as WebBrowser from 'expo-web-browser'
import { useEffect } from 'react'

WebBrowser.maybeCompleteAuthSession()

export const useOAuthConfig = () => {
  const production = {
    CLIENT_ID: 'polar_ci_yZLBGwoWZVsOdfN5CODRwVSTlJfwJhXqwg65e2CuNMZ',
    discovery: {
      authorizationEndpoint: 'https://polar.sh/oauth2/authorize',
      tokenEndpoint: 'https://api.polar.sh/v1/oauth2/token',
      registrationEndpoint: 'https://api.polar.sh/v1/oauth2/register',
      revocationEndpoint: 'https://api.polar.sh/v1/oauth2/revoke',
    },
  }

  const development = {
    CLIENT_ID: 'polar_ci_hbFdMZZRghgdm2F4LMceQSrcQNunmjlh6ukGJ1dG0Vg',
    discovery: {
      authorizationEndpoint: `http://127.0.0.1:3000/oauth2/authorize`,
      tokenEndpoint: `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/oauth2/token`,
      registrationEndpoint: `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/oauth2/register`,
      revocationEndpoint: `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/oauth2/revoke`,
    },
  }

  const scopes = [
    'benefits:read',
    'benefits:write',
    'checkout_links:read',
    'checkout_links:write',
    'checkouts:read',
    'checkouts:write',
    'custom_fields:read',
    'custom_fields:write',
    'customer_meters:read',
    'customer_portal:read',
    'customer_portal:write',
    'customer_seats:read',
    'customer_seats:write',
    'customer_sessions:write',
    'customers:read',
    'customers:write',
    'discounts:read',
    'discounts:write',
    'disputes:read',
    'email',
    'events:read',
    'events:write',
    'files:read',
    'files:write',
    'license_keys:read',
    'license_keys:write',
    'member_sessions:write',
    'members:read',
    'members:write',
    'meters:read',
    'meters:write',
    'metrics:read',
    'metrics:write',
    'notification_recipients:read',
    'notification_recipients:write',
    'notifications:read',
    'notifications:write',
    'openid',
    'orders:read',
    'orders:write',
    'organization_access_tokens:read',
    'organization_access_tokens:write',
    'organizations:read',
    'organizations:write',
    'payments:read',
    'payouts:read',
    'payouts:write',
    'products:read',
    'products:write',
    'profile',
    'refunds:read',
    'refunds:write',
    'subscriptions:read',
    'subscriptions:write',
    'transactions:read',
    'transactions:write',
    'user:read',
    'user:write',
    'wallets:read',
    'wallets:write',
    'webhooks:read',
    'webhooks:write',
  ]

  return {
    scopes,
    ...production,
  }
}

export const useOAuth = () => {
  const { setSession } = useSession()

  useEffect(() => {
    WebBrowser.warmUpAsync()

    return () => {
      WebBrowser.coolDownAsync()
    }
  }, [])

  const { CLIENT_ID, scopes, discovery } = useOAuthConfig()
  const [authRequest, , promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes,
      redirectUri: makeRedirectUri({
        scheme: 'polar',
        path: 'oauth/callback',
      }),
      usePKCE: true,
      extraParams: {
        do_not_track: 'true',
        sub_type: 'user',
      },
    },
    discovery,
  )

  const authenticate = async () => {
    try {
      const response = await promptAsync({ preferEphemeralSession: true })

      if (response?.type !== 'success') {
        Sentry.captureMessage('[OAuth] auth session failed', {
          level: 'warning',
          extra: { responseType: response?.type, response },
        })
        return
      }

      const token = await exchangeCodeAsync(
        {
          clientId: CLIENT_ID,
          code: response.params.code,
          redirectUri: makeRedirectUri({
            scheme: 'polar',
            path: 'oauth/callback',
          }),
          extraParams: {
            code_verifier: authRequest?.codeVerifier ?? '',
          },
        },
        discovery,
      )

      setSession(token.accessToken)
    } catch (error) {
      Sentry.captureException(error, {
        extra: { context: 'oauth_authenticate' },
      })
      console.error('[OAuth] Error:', error)
    }
  }

  return { authRequest, authenticate }
}
