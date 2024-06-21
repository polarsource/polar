'use client'

import { api } from '@/utils/api'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export const useSendMagicLink = () => {
  const router = useRouter()
  const func = useCallback(
    async (email: string, return_to?: string) => {
      await api.magicLink.magicLinkRequest({
        magicLinkRequest: { email, return_to },
      })
      const searchParams = new URLSearchParams({ email: email })
      router.push(`/login/magic-link/request?${searchParams}`)
    },
    [router],
  )
  return func
}
