import { useRouter } from 'next/router'
import { CancelablePromise, type UserRead } from 'polarkit/api/client'
import { useHasHydrated } from 'polarkit/hooks'
import { UserState, useStore } from 'polarkit/store'
import { useEffect, useState } from 'react'

export const useAuth = (): UserState & {
  hasChecked: boolean
  isChecking: boolean
  reloadUser: () => CancelablePromise<UserRead>
} => {
  const hasHydrated = useHasHydrated()
  const authenticated = useStore((state) => state.authenticated)
  const currentUser = useStore((state) => state.currentUser)
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

  const reloadUser = (): CancelablePromise<UserRead> => {
    setIsChecking(true)
    return login(() => {
      setIsChecking(false)
      setHasChecked(true)
    })
  }

  /*
   * We're not supporting serverside authentication/session via NextJS.
   * So unless we've hydrated and are on the clientside, we need to always
   * return an empty session to avoid hydration errors.
   */
  if (!hasHydrated) {
    return {
      authenticated: false,
      currentUser: undefined,
      hasChecked: false,
      isChecking: false,
      login,
      logout,
      reloadUser,
    }
  }
  return {
    authenticated,
    currentUser,
    hasChecked,
    isChecking,
    login,
    logout,
    reloadUser,
  }
}

export const useRequireAuth = (
  redirectTo: string = '/',
): UserState & {
  hasChecked: boolean
  isChecking: boolean
} => {
  // TODO: Change this to be given by the app. Currently forcing next router
  const router = useRouter()
  const session = useAuth()

  if (!session.authenticated && session.hasChecked) {
    router.push(redirectTo)
  }

  return session
}
