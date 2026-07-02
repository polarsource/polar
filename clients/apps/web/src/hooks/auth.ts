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

export const useOrgAuthSessionStart = (slug: string) =>
  useMutation({
    mutationFn: (return_to?: string) =>
      api.POST('/v1/auth/{slug}/start', {
        params: { path: { slug } },
        body: { return_to },
      }),
  })

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

export const useBackupCodesVerify = () =>
  useMutation({
    mutationFn: (body: { code: string }) =>
      api.POST('/v1/auth/backup-codes/verify', { body }),
  })

export const useTOTPStatus = () =>
  useQuery({
    queryKey: ['totp', 'status'],
    queryFn: async () => {
      const { data, response } = await api.GET('/v1/auth/totp')
      if (response.status === 404) return { enabled: false }
      if (!response.ok) throw new Error('Failed to fetch TOTP status')
      return data ?? { enabled: false }
    },
    retry: false,
  })

export const useTOTPEnroll = () =>
  useMutation({
    mutationFn: () => api.POST('/v1/auth/totp', {}),
  })

export const useTOTPEnable = () =>
  useMutation({
    mutationFn: (code: string) =>
      api.POST('/v1/auth/totp/enable', { body: { code } }),
  })

export const useTOTPDelete = () =>
  useMutation({
    mutationFn: () => api.DELETE('/v1/auth/totp'),
  })

export const useBackupCodesStatus = () =>
  useQuery({
    queryKey: ['backup-codes', 'status'],
    queryFn: async () => {
      const { data, response } = await api.GET('/v1/auth/backup-codes')
      if (response.status === 404) return null
      if (!response.ok) throw new Error('Failed to fetch backup codes status')
      return data
    },
    retry: false,
  })

export const useBackupCodesEnroll = () =>
  useMutation({
    mutationFn: () => api.POST('/v1/auth/backup-codes', {}),
  })
