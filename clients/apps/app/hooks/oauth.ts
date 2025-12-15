import { useSession } from '@/providers/SessionProvider'
import {
  exchangeCodeAsync,
  makeRedirectUri,
  useAuthRequest,
} from 'expo-auth-session'
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

  const scopes = ['openid', 'profile', 'email', 'web:read', 'web:write']

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
      console.error('[OAuth] Error:', error)
    }
  }

  return { authRequest, authenticate }
}
