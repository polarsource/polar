import { useSession } from '@/providers/SessionProvider'
import {
  exchangeCodeAsync,
  makeRedirectUri,
  useAuthRequest,
} from 'expo-auth-session'
import * as Sentry from '@sentry/react-native'
import * as WebBrowser from 'expo-web-browser'
import { useEffect } from 'react'
import { Linking, Platform } from 'react-native'

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
    'openid',
    'profile',
    'email',
    'web:read',
    'web:write',
    'notifications:read',
    'notifications:write',
    'notification_recipients:read',
    'notification_recipients:write',
  ]

  return {
    scopes,
    ...production,
  }
}

/**
 * On Android, expo-web-browser's openAuthSessionAsync uses an AppState polyfill
 * that races "app became active" against "redirect URL received". On some devices
 * (e.g. Xiaomi/HyperOS) AppState fires 'active' before the Linking event arrives,
 * resolving the session as 'dismiss' and losing the auth code.
 *
 * This bypasses the polyfill by opening the Custom Tab directly and listening
 * for the redirect ourselves.
 */
function openAuthSessionAndroid(
  url: string,
  redirectUri: string,
): Promise<{ type: 'success'; url: string } | { type: 'dismiss' }> {
  return new Promise((resolve) => {
    const sub = Linking.addEventListener('url', (event) => {
      if (event.url.startsWith(redirectUri)) {
        sub.remove()
        resolve({ type: 'success', url: event.url })
      }
    })

    WebBrowser.openBrowserAsync(url, { createTask: false })
  })
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
  const redirectUri = makeRedirectUri({
    scheme: 'polar',
    path: 'oauth/callback',
  })
  const [authRequest, , promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes,
      redirectUri,
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
      if (Platform.OS === 'android') {
        if (!authRequest?.url) return

        const result = await openAuthSessionAndroid(
          authRequest.url,
          redirectUri,
        )
        if (result.type !== 'success') return

        const code = new URL(result.url).searchParams.get('code')
        if (!code) return

        const token = await exchangeCodeAsync(
          {
            clientId: CLIENT_ID,
            code,
            redirectUri,
            extraParams: {
              code_verifier: authRequest?.codeVerifier ?? '',
            },
          },
          discovery,
        )

        setSession(token.accessToken)
      } else {
        const response = await promptAsync({ preferEphemeralSession: true })

        if (response?.type !== 'success') {
          return
        }

        const token = await exchangeCodeAsync(
          {
            clientId: CLIENT_ID,
            code: response.params.code,
            redirectUri,
            extraParams: {
              code_verifier: authRequest?.codeVerifier ?? '',
            },
          },
          discovery,
        )

        setSession(token.accessToken)
      }
    } catch (error) {
      Sentry.captureException(error, {
        extra: { context: 'oauth_authenticate' },
      })
      console.error('[OAuth] Error:', error)
    }
  }

  return { authRequest, authenticate }
}
