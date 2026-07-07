'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { isSessionNotFreshError } from '@/utils/api/errors'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback } from 'react'

export const useSessionRefreshPrompt = () => {
  const router = useRouter()
  const pathname = usePathname()
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
      onConfirm={() =>
        router.push(`/auth?return_to=${encodeURIComponent(pathname ?? '/')}`)
      }
    />
  )

  return { promptIfSessionNotFresh, sessionRefreshModal }
}
