import { CancelablePromise, UserRead } from 'polarkit/api/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useHasHydrated } from './hydration'
import { UserState, useStore } from '../store'

export const useAuth = (): UserState & {
  hasChecked: boolean
  isChecking: boolean
} => {
  const hasHydrated = useHasHydrated()
  const authenticated = useStore((state) => state.authenticated)
  const user = useStore((state) => state.user)
  const login = useStore((state) => state.login)
  const logout = useStore((state) => state.logout)

  const [hasChecked, setHasChecked] = useState(authenticated)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    if (hasChecked || authenticated) {
      return
    }

    setIsChecking(true)
    let request: CancelablePromise<UserRead> = login(() => {
      setIsChecking(false)
      setHasChecked(true)
    })

    // Cleanup
    return () => {
      if (request) {
        request.cancel()
      }
    }
  }, [authenticated, hasChecked, login])

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
      isChecking: false,
      login,
      logout,
    }
  }
  return { authenticated, user, hasChecked, isChecking, login, logout }
}

export const requireAuth = (redirectTo: string = '/'): UserState => {
  // TODO: Change this to be given by the app. Currently forcing next router
  const router = useRouter()
  const session = useAuth()

  if (!session.authenticated && session.hasChecked) {
    router.push(redirectTo)
  }
  return session
}
