import { refreshUser } from '@/app/actions'
import { usePostHog } from '@/hooks/posthog'
import { AuthContext } from '@/providers/auth'
import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import * as Sentry from '@sentry/nextjs'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useContext, useEffect } from 'react'

const reloadUser = async () => {
  try {
    await refreshUser()
  } catch (error) {
    Sentry.captureException(error)
  }
}

export const useAuth = (): {
  authenticated: boolean
  currentUser: schemas['UserRead'] | undefined
  reloadUser: () => Promise<void>
  userOrganizations: schemas['OrganizationWithRole'][]
} => {
  const posthog = usePostHog()
  const currentUser = useContext(AuthContext)

  useEffect(() => {
    if (currentUser) {
      Sentry.setUser({
        id: currentUser.id,
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
    userOrganizations: currentUser?.organizations ?? [],
  }
}

export const useLogout = (): (() => void) => {
  const posthog = usePostHog()

  return useCallback(() => {
    posthog.reset()
    window.location.href = `${CONFIG.BASE_URL}/v1/auth/logout`
  }, [posthog])
}

export const useAuthSessionStart = () => {
  const searchParams = useSearchParams()
  const sso_discovery = searchParams.get('sso_discovery') !== 'false'
  return useMutation({
    mutationFn: (return_to?: string) =>
      api.POST('/v1/auth/start', { body: { return_to, sso_discovery } }),
  })
}

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
    mutationFn: ({
      email,
      turnstileToken,
    }: {
      email: string
      turnstileToken: string
    }) =>
      api.POST('/v1/auth/email-otp/request', {
        body: { email, 'cf-turnstile-response': turnstileToken },
      }),
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
    onSuccess: async (result) => {
      if (result.error) return
      await getQueryClient().invalidateQueries({ queryKey: ['totp', 'status'] })
    },
  })

export const useTOTPDelete = () =>
  useMutation({
    mutationFn: () => api.DELETE('/v1/auth/totp'),
    onSuccess: async (result) => {
      if (result.error) return
      await Promise.all([
        getQueryClient().invalidateQueries({ queryKey: ['totp', 'status'] }),
        getQueryClient().invalidateQueries({
          queryKey: ['backup-codes', 'status'],
        }),
      ])
    },
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
    onSuccess: async (result) => {
      if (result.error) return
      await getQueryClient().invalidateQueries({
        queryKey: ['backup-codes', 'status'],
      })
    },
  })
