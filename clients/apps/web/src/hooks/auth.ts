import { usePostHog } from '@/hooks/posthog'
import { AuthContext } from '@/providers/auth'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@spaire/client'
import * as Sentry from '@sentry/nextjs'
import { useContext, useEffect } from 'react'

export const useAuth = (): {
  authenticated: boolean
  currentUser: schemas['UserRead'] | undefined
  reloadUser: () => Promise<undefined>
  userOrganizations: schemas['Organization'][]
  setUserOrganizations: React.Dispatch<
    React.SetStateAction<schemas['Organization'][]>
  >
} => {
  const posthog = usePostHog()
  const {
    user: currentUser,
    setUser: setCurrentUser,
    userOrganizations,
    setUserOrganizations,
  } = useContext(AuthContext)

  const reloadUser = async (): Promise<undefined> => {
    const user = await unwrap(api.GET('/v1/users/me'))
    setCurrentUser(user)
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
