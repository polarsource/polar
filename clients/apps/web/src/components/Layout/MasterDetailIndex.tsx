'use client'

import useIsMobile from '@/utils/mobile'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export const MasterDetailIndex = ({
  redirectTo,
}: {
  redirectTo: string
}) => {
  const { isMobile, isLoading } = useIsMobile()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isMobile) {
      router.replace(redirectTo)
    }
  }, [isLoading, isMobile, redirectTo, router])

  return null
}
