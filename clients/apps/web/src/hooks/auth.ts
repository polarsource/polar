import { useRouter } from 'next/router'
import { CancelablePromise, type UserRead } from 'polarkit/api/client'
import { UserState, useStore } from 'polarkit/store'
import { useCallback, useEffect, useState } from 'react'

export const useAuth = (): UserState & {
  hasChecked: boolean
  isChecking: boolean
  reloadUser: () => CancelablePromise<UserRead>
} => {
  const authenticated = useStore((state) => state.authenticated)
  const currentUser = useStore((state) => state.currentUser)
  const login = useStore((state) => state.login)
  const logout = useStore((state) => state.logout)

  const [hasChecked, setHasChecked] = useState(authenticated)
  const [isChecking, setIsChecking] = useState(false)

  const getAuthenticatedUser = useCallback((): CancelablePromise<UserRead> => {
    setIsChecking(true)
    return login(() => {
      setIsChecking(false)
      setHasChecked(true)
    })
  }, [setIsChecking, setHasChecked, login])

  useEffect(() => {
    if (hasChecked || authenticated) {
      return
    }

    let request = getAuthenticatedUser()
    return () => {
      if (request) {
        request.cancel()
      }
    }
  }, [authenticated, hasChecked, getAuthenticatedUser])

  return {
    authenticated,
    currentUser,
    hasChecked,
    isChecking,
    login,
    logout,
    reloadUser: getAuthenticatedUser,
  }
}

export const useRequireAuth = (
  redirectTo: string = '/',
): UserState & {
  hasChecked: boolean
  isChecking: boolean
} => {
  const router = useRouter()
  const session = useAuth()

  if (!session.authenticated && session.hasChecked) {
    router.push(redirectTo)
  }

  return session
}
