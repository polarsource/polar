'use client'

import { PublicPageOrganizationContext } from '@/providers/organization'
import { api, isOnCustomDomain } from '@/utils/api'
import { CONFIG } from '@/utils/config'
import { useRouter } from 'next/navigation'
import { useCallback, useContext } from 'react'

export const useSendMagicLink = () => {
  const router = useRouter()

  // Get org state from context (may or may not be set)
  const org = useContext(PublicPageOrganizationContext)

  const func = useCallback(
    async (email: string, return_to?: string) => {
      if (!return_to) {
        return_to = window.location.href
      }

      if (isOnCustomDomain()) {
        const s = new URLSearchParams()
        // TODO: support return_to on custom domains
        s.set('return_to', '/')
        if (org) {
          s.set('for_organization_id', org.id)
        }

        return_to = `${CONFIG.FRONTEND_BASE_URL}/login?${s.toString()}`
      }

      await api.magicLink.magicLinkRequest({
        magicLinkRequest: { email, return_to },
      })
      const searchParams = new URLSearchParams({ email: email })

      // always on polar.sh
      router.push(
        `${CONFIG.FRONTEND_BASE_URL}/login/magic-link/request?${searchParams}`,
      )
    },
    [router, org],
  )

  return func
}
