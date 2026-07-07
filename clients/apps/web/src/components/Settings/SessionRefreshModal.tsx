'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { isSessionNotFreshError } from '@/utils/api/errors'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export const useSessionRefreshPrompt = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isShown, show, hide } = useModal()

  const promptIfSessionNotFresh = useCallback(
    (error: unknown): boolean => {
      if (!isSessionNotFreshError(error)) {
        return false
      }
      show()
      return true
    },
    [show],
  )

  const sessionRefreshModal = (
    <ConfirmModal
      isShown={isShown}
      hide={hide}
      title="Please sign in again"
      description="For your security, this action requires that you signed in recently. Sign in again to continue."
      onConfirm={() => {
        const query = searchParams?.toString()
        const returnTo = `${pathname ?? '/'}${query ? `?${query}` : ''}`
        router.push(`/auth?return_to=${encodeURIComponent(returnTo)}`)
      }}
    />
  )

  return { promptIfSessionNotFresh, sessionRefreshModal }
}
