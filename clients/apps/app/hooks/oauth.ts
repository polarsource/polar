import { CLIENT_ID, discovery, scopes } from '@/auth/oauthConfig'
import { useSession } from '@/providers/SessionProvider'
import * as Sentry from '@sentry/react-native'
import {
  exchangeCodeAsync,
  makeRedirectUri,
  useAuthRequest,
} from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { useEffect } from 'react'

WebBrowser.maybeCompleteAuthSession()

export const useOAuthConfig = () => ({
  CLIENT_ID,
  discovery,
  scopes,
})

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

      setSession({
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt:
          typeof token.expiresIn === 'number'
            ? Date.now() + token.expiresIn * 1000
            : null,
      })
    } catch (error) {
      Sentry.captureException(error, {
        extra: { context: 'oauth_authenticate' },
      })
      console.error('[OAuth] Error:', error)
    }
  }

  return { authRequest, authenticate }
}
