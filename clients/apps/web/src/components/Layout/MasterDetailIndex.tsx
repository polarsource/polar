'use client'

import { MOBILE_MEDIA_QUERY } from '@/utils/mobile'
import { redirect } from 'next/navigation'

export const MasterDetailIndex = ({ redirectTo }: { redirectTo: string }) => {
  const isBrowser = typeof window !== 'undefined'
  const isDesktop = isBrowser && !window.matchMedia(MOBILE_MEDIA_QUERY).matches

  if (isDesktop) {
    redirect(redirectTo)
  }

  return null
}
