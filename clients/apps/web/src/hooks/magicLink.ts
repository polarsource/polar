'use client'

import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export class MagicLinkError extends Error {
  error: schemas['ValidationError'][] | undefined

  constructor(error: schemas['ValidationError'][] | undefined) {
    super('Magic Link Error')
    this.error = error
  }
}

export const useSendMagicLink = () => {
  const router = useRouter()
  const func = useCallback(
    async (
      email: string,
      return_to?: string,
      signup?: schemas['UserSignupAttribution'],
    ) => {
      const { error } = await api.POST('/v1/magic_link/request', {
        body: { email, return_to, signup },
      })

      if (error) {
        throw new MagicLinkError(error.detail)
      }

      const searchParams = new URLSearchParams({ email: email })
      router.push(`/login/magic-link/request?${searchParams}`)
    },
    [router],
  )
  return func
}
