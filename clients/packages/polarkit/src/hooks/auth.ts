import { api } from 'polarkit/api'
import { CancelablePromise, UserRead } from 'polarkit/api/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useHasHydrated } from './hydration'
import { AuthSlice, useStore } from '../store'

export const useAuth = (): AuthSlice => {
  const hasHydrated = useHasHydrated()
  const hasChecked = useStore((state) => state.hasChecked)
  const authenticated = useStore((state) => state.authenticated)
  const user = useStore((state) => state.user)
  const login = useStore((state) => state.login)

  useEffect(() => {
    let request: CancelablePromise<UserRead>
    if (authenticated) {
      useStore.setState({ hasChecked: true })
    } else if (!hasChecked) {
      request = login()
    }

    // Cleanup
    return () => {
      if (request) {
        request.cancel()
      }
    }
  }, [])

  /*
   * We're not supporting serverside authentication/session via NextJS.
   * So unless we've hydrated and are on the clientside, we need to always
   * return an empty session to avoid hydration errors.
   */
  if (!hasHydrated) {
    return {
      authenticated: false,
      user: null,
      hasChecked: false,
      login,
    }
  }
  return { authenticated, user, hasChecked, login }
}

export const requireAuth = (redirectTo: string = '/'): AuthSlice => {
  // TODO: Change this to be given by the app. Currently forcing next router
  const router = useRouter()

  const session = useAuth()
  useEffect(() => {
    if (!session.authenticated && session.hasChecked) {
      router.push(redirectTo)
    }
  }, [session.hasChecked])
  return session
}

const exchangeOAuthCode = async (
  code: string,
  state: string,
  onSuccess?: () => void,
  onError?: (error: any) => void,
) => {
  return await api.integrations
    .githubCallback({
      code: code,
      state: state,
    })
    .then((res: { authenticated: boolean }) => {
      if (res.authenticated && onSuccess) {
        onSuccess()
      }
    })
    .catch((error: any) => {
      if (onError) {
        onError(error)
      }
    })
}

export const useOAuthExchange = async (
  code: string,
  state: string,
): Promise<{
  exchanged: boolean
  session: AuthSlice
  error: string | null
}> => {
  const router = useRouter()
  const session = useAuth()
  const hasHydrated = useHasHydrated()
  const [exchanged, setExchanged] = useState(false)

  if (!code || !state) {
    return {
      exchanged: false,
      session: session,
      error: 'Need a Github OAuth Code & State',
    }
  }

  if (hasHydrated && !exchanged) {
    exchangeOAuthCode(code, state, () => {
      session.login(() => {
        router.push('/dashboard')
      })
    })
    setExchanged(true)
  }
  return { exchanged, session: session, error: null }
}
