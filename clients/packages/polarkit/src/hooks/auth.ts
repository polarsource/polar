import { CancelablePromise, UserRead } from 'polarkit/api/client'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useHasHydrated } from './hydration'
import { AuthSlice, useStore } from '../store'

export const useAuth = (): AuthSlice => {
  const hasHydrated = useHasHydrated()
  const hasChecked = useStore((state) => state.hasChecked)
  const authenticated = useStore((state) => state.authenticated)
  const user = useStore((state) => state.user)
  const login = useStore((state) => state.login)
  const logout = useStore((state) => state.logout)

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
      logout,
    }
  }
  return { authenticated, user, hasChecked, login, logout }
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
