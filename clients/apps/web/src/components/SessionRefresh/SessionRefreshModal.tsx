'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { setSessionRefreshListener } from './store'

export const SessionRefreshModal = () => {
  const router = useRouter()
  const [isShown, setShown] = useState(false)

  useEffect(() => {
    setSessionRefreshListener(() => setShown(true))
    return () => setSessionRefreshListener(null)
  }, [])

  return (
    <ConfirmModal
      isShown={isShown}
      hide={() => setShown(false)}
      title="Please sign in again"
      description="For your security, this action requires that you signed in recently. Sign in again to continue."
      onConfirm={() => {
        const returnTo = `${window.location.pathname}${window.location.search}`
        router.push(`/auth?return_to=${encodeURIComponent(returnTo)}`)
      }}
    />
  )
}
