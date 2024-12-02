import { usePostHog } from '@/hooks/posthog'
import { AuthContext } from '@/providers/auth'
import { api } from '@/utils/api'
import { Organization, UserRead } from '@polar-sh/sdk'
import * as Sentry from '@sentry/nextjs'
import { useContext, useEffect } from 'react'

export const useAuth = (): {
  authenticated: boolean
  currentUser: UserRead | undefined
  reloadUser: () => Promise<undefined>
  userOrganizations: Organization[]
  setUserOrganizations: React.Dispatch<React.SetStateAction<Organization[]>>
} => {
  const posthog = usePostHog()
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
      })

      posthog.identify(currentUser)
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
