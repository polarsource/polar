import { type UserRead } from '@polar-sh/sdk'
import * as Sentry from '@sentry/nextjs'
import { UserState, useStore } from 'polarkit/store'
import posthog from 'posthog-js'
import { useCallback, useEffect, useState } from 'react'

export const useAuth = (): UserState & {
  hasChecked: boolean
  isChecking: boolean
  reloadUser: () => Promise<UserRead>
  hydrated: boolean
} => {
  const authenticated = useStore((state) => state.authenticated)
  const currentUser = useStore((state) => state.currentUser)
  const login = useStore((state) => state.login)
  const logout = useStore((state) => state.logout)

  const [hydrated, setHydrated] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    if (currentUser) {
      Sentry.setUser({
        id: currentUser.id,
        email: currentUser.email,
        username: currentUser.username,
      })

      try {
        const posthogId = `user:${currentUser.id}`
        if (posthog.get_distinct_id() !== posthogId) {
          posthog.identify(posthogId, {
            username: currentUser.username,
            email: currentUser.email,
          })
        }
        // Handle case where PostHog is not initialized
      } catch {}
    } else {
      Sentry.setUser(null)
    }
  }, [currentUser])

  const getAuthenticatedUser = useCallback((): {
    request: Promise<UserRead>
    controller: AbortController
  } => {
    setIsChecking(true)
    return login(() => {
      setIsChecking(false)
      setHasChecked(true)
    })
  }, [setIsChecking, setHasChecked, login])

  useEffect(() => {
    setHydrated(true)
    if (hasChecked || authenticated) {
      return
    }

    let { controller } = getAuthenticatedUser()
    return () => {
      controller.abort()
    }
  }, [authenticated, hasChecked, getAuthenticatedUser, hydrated])

  if (!hydrated) {
    return {
      authenticated: false,
      currentUser: undefined,
      hasChecked: false,
      isChecking: false,
      login,
      logout,
      reloadUser: () => {
        const { request } = getAuthenticatedUser()
        return request
      },
      hydrated,
    }
  }

  return {
    authenticated,
    currentUser,
    hasChecked,
    isChecking,
    login,
    logout,
    reloadUser: () => {
      const { request } = getAuthenticatedUser()
      return request
    },
    hydrated,
  }
}
