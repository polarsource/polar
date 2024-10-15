import { AuthContext } from '@/providers/auth'
import { api } from '@/utils/api'
import { CONFIG } from '@/utils/config'
import { Organization, UserRead } from '@polar-sh/sdk'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { useCallback, useContext, useEffect } from 'react'

export const useAuth = (): {
  authenticated: boolean
  currentUser: UserRead | undefined
  reloadUser: () => Promise<undefined>
  userOrganizations: Organization[]
  setUserOrganizations: React.Dispatch<React.SetStateAction<Organization[]>>
} => {
  const {
    user: currentUser,
    setUser: setCurrentUser,
    userOrganizations,
    setUserOrganizations,
  } = useContext(AuthContext)

  const reloadUser = async (): Promise<undefined> => {
    try {
      const user = await api.users.getAuthenticated()
      setCurrentUser(user)
    } catch {}
  }

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

  return {
    currentUser,
    authenticated: currentUser !== undefined,
    reloadUser,
    userOrganizations,
    setUserOrganizations,
  }
}

export const useLogout = () => {
  const func = useCallback(async () => {
    // polar.sh logout
    posthog.capture('user:logout:done')
    posthog.reset()
    window.location.href = `${CONFIG.BASE_URL}/v1/auth/logout`
    return
  }, [])

  return func
}
