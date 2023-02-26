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
  }, [authenticated, hasChecked])

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

  if (!session.authenticated && session.hasChecked) {
    router.push(redirectTo)
  }
  return session
}

export const useOAuthExchange = (
  code: string,
  state: string,
): {
  success: boolean
  error: string | null
} => {
  const session = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)

  const login = async () => {
    session.login((authenticated: boolean) => {
      if (authenticated) {
        setSuccess(true)
      } else {
        setError('Something went wrong logging in')
      }
    })
  }

  useEffect(() => {
    let cancelled = false
    let request = CancelablePromise<any>
    if (!code || !state) {
      setError('We need both an OAuth code and state')
      return
    }

    const exchange = async () => {
      try {
        request = api.integrations.githubCallback({
          code: code,
          state: state,
        })
        const response = await request
        const { authenticated } = response
        if (authenticated && !cancelled) {
          await login()
          return
        }
        setError('Invalid response')
      } catch (err) {
        if (err.isCancelled) return
        setError('Something went wrong exchanging the OAuth code for a cookie')
      }
    }

    exchange()
    return () => {
      if (request) {
        request.cancel()
        cancelled = true
      }
    }
  }, [code, state])

  return { success, error }
}
