'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { type SessionRefreshOptions, setSessionRefreshListener } from './store'

export const SessionRefreshModal = () => {
  const router = useRouter()
  const [isShown, setShown] = useState(false)
  const [options, setOptions] = useState<SessionRefreshOptions>({})

  useEffect(() => {
    setSessionRefreshListener((nextOptions = {}) => {
      setOptions((currentOptions) =>
        nextOptions.returnTo === undefined ? currentOptions : nextOptions,
      )
      setShown(true)
    })
    return () => setSessionRefreshListener(null)
  }, [])

  const hide = () => {
    setShown(false)
    setOptions({})
  }

  return (
    <ConfirmModal
      isShown={isShown}
      hide={hide}
      title="Please sign in again"
      description="For your security, this action requires that you signed in recently. Sign in again to continue."
      onConfirm={() => {
        const returnTo =
          options.returnTo ??
          `${window.location.pathname}${window.location.search}`
        router.push(`/auth?return_to=${encodeURIComponent(returnTo)}`)
      }}
    />
  )
}
