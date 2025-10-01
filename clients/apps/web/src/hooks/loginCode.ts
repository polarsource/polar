'use client'

import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export class LoginCodeError extends Error {
  error: schemas['ValidationError'][] | undefined

  constructor(error: schemas['ValidationError'][] | undefined) {
    super('Login Code Error')
    this.error = error
  }
}

export const useSendLoginCode = () => {
  const router = useRouter()
  const func = useCallback(
    async (
      email: string,
      return_to?: string,
      signup?: schemas['UserSignupAttribution'],
    ) => {
      const { error } = await api.POST('/v1/login-code/request', {
        body: { email, return_to, attribution: signup },
      })

      if (error) {
        throw new LoginCodeError(error.detail)
      }

      const searchParams = new URLSearchParams({ email: email })
      if (return_to) {
        searchParams.append('return_to', return_to)
      }
      router.push(`/login/code/verify?${searchParams}`)
    },
    [router],
  )
  return func
}
