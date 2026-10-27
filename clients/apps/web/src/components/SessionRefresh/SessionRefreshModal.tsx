'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { type SessionRefreshOptions, setSessionRefreshListener } from './store'

export const SessionRefreshModal = () => {
  const router = useRouter()
  const [isShown, setShown] = useState(false)
  const optionsRef = useRef<SessionRefreshOptions>({})

  useEffect(() => {
    setSessionRefreshListener((nextOptions = {}) => {
      if (nextOptions.returnTo !== undefined) {
        optionsRef.current = nextOptions
      }
      setShown(true)
    })
    return () => setSessionRefreshListener(null)
  }, [])

  const hide = () => {
    setShown(false)
    optionsRef.current = {}
  }

  return (
    <ConfirmModal
      isShown={isShown}
      hide={hide}
      title="Please sign in again"
      description="For your security, this action requires that you signed in recently. Sign in again to continue."
      onConfirm={() => {
        const returnTo =
          optionsRef.current.returnTo ??
          `${window.location.pathname}${window.location.search}`
        router.push(`/auth?return_to=${encodeURIComponent(returnTo)}`)
      }}
    />
  )
}
