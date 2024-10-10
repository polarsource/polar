'use client'

import { api } from '@/utils/api'
import { UserSignupAttribution, MagicLinkRequest } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export const useSendMagicLink = () => {
  const router = useRouter()
  const func = useCallback(
    async (email: string, return_to?: string, user_attribution?: UserSignupAttribution) => {
      let body: MagicLinkRequest = { email, return_to }
      if (user_attribution) {
        body = { ...body, user_attribution }
      }

      await api.magicLink.magicLinkRequest({
        body,
      })
      const searchParams = new URLSearchParams({ email: email })
      router.push(`/login/magic-link/request?${searchParams}`)
    },
    [router],
  )
  return func
}
