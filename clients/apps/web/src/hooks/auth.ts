import { AuthContext } from '@/providers/auth'
import { PublicPageOrganizationContext } from '@/providers/organization'
import { UserRead } from '@polar-sh/sdk'
import * as Sentry from '@sentry/nextjs'
import { api } from 'polarkit/api'
import { CONFIG } from 'polarkit/config'
import posthog from 'posthog-js'
import { useCallback, useContext, useEffect, useState } from 'react'

export const useAuth = (): {
  authenticated: boolean
  currentUser: UserRead | undefined
  reloadUser: () => Promise<undefined>
} => {
  const authCtx = useContext(AuthContext)

  if (!authCtx) {
    throw new Error('can not use useAuth outside of AuthContext')
  }

  const [currentUser, setCurrentUser] = useState(authCtx.user)

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
    currentUser: authCtx.user,
    authenticated: authCtx.user !== undefined,
    reloadUser,
  }
}

export const useLogout = () => {
  const org = useContext(PublicPageOrganizationContext)

  const func = useCallback(async () => {
    // custom domain logout
    if (org && org.custom_domain) {
      window.location.href = `${CONFIG.BASE_URL}/api/v1/auth/logout?organization_id=${org.id}`
      return
    }

    // polar.sh logout
    window.location.href = `${CONFIG.BASE_URL}/api/v1/auth/logout`
    return
  }, [org, useLogout])

  return func
}
