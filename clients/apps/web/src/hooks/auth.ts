import { usePostHog } from '@/hooks/posthog'
import { AuthContext } from '@/providers/auth'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import * as Sentry from '@sentry/nextjs'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useContext, useEffect } from 'react'

export const useAuth = (): {
  authenticated: boolean
  currentUser: schemas['UserRead'] | undefined
  reloadUser: () => Promise<undefined>
  userOrganizations: schemas['OrganizationWithRole'][]
  setUserOrganizations: React.Dispatch<
    React.SetStateAction<schemas['OrganizationWithRole'][]>
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
  }, [currentUser, posthog])

  return {
    currentUser,
    authenticated: currentUser !== undefined,
    reloadUser,
    userOrganizations,
    setUserOrganizations,
  }
}

export const useAuthSessionStart = () =>
  useMutation({
    mutationFn: (return_to?: string) =>
      api.POST('/v1/auth/start', { body: { return_to } }),
  })

export const useAuthSessionStatus = () => {
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => api.GET('/v1/auth/status'),
    retry: false,
  })
}

export const useEmailOTPRequest = () =>
  useMutation({
    mutationFn: (email: string) =>
      api.POST('/v1/auth/email-otp/request', { body: { email } }),
  })

export const useEmailOTPVerify = () =>
  useMutation({
    mutationFn: (code: string) =>
      api.POST('/v1/auth/email-otp/verify', { body: { code } }),
  })

export const useTOTPVerify = () =>
  useMutation({
    mutationFn: (code: string) =>
      api.POST('/v1/auth/totp/verify', { body: { code } }),
  })
