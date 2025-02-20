'use client'

import { CONFIG } from '@/utils/config'
import { usePathname } from 'next/navigation'

export const useLoginLink = () => {
  const pathname = usePathname()
  const host =
    typeof window !== 'undefined'
      ? window.location.protocol + '//' + window.location.host
      : CONFIG.FRONTEND_BASE_URL
  const returnToPrefix = host !== CONFIG.FRONTEND_BASE_URL ? host : ''
  const loginReturnTo = pathname
    ? `${returnToPrefix}${pathname}`
    : `${returnToPrefix}/start`

  return `${CONFIG.FRONTEND_BASE_URL}/login?return_to=${loginReturnTo}`
}
