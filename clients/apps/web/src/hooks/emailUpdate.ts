'use client'

import { api } from "@/utils/api"
import { EmailUpdateRequest } from "@polar-sh/sdk"
import { useRouter } from "next/navigation"
import { useCallback } from "react"

export const useSendEmailUpdate = () => {
  const router = useRouter()
  const func = useCallback(
    async (email: string, return_to?: string) => {
      const body: EmailUpdateRequest = {
        email,
        return_to,
      }
      await api.emailUpdate.requestEmailUpdate({ body })
    },
    [router],
  )
  return func
}
