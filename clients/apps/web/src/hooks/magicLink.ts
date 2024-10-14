'use client'

import { api } from '@/utils/api'
import { UserSignupAttribution, MagicLinkRequest } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export const useSendMagicLink = () => {
  const router = useRouter()
  const func = useCallback(
    async (email: string, return_to?: string, signup?: UserSignupAttribution) => {
      const body: MagicLinkRequest = {
        email,
        return_to,
        attribution: signup,
      }
      await api.magicLink.magicLinkRequest({ body })
      const searchParams = new URLSearchParams({ email: email })
      router.push(`/login/magic-link/request?${searchParams}`)
    },
    [router],
  )
  return func
}
