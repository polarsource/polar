'use client'

import { api } from '@/utils/client'
import { useCallback } from 'react'

export const useSendEmailUpdate = () => {
  const func = useCallback(
    async (email: string, return_to?: string) =>
      api.POST('/v1/email-update/request', { body: { email, return_to } }),
    [],
  )
  return func
}
