import { toast } from '@/components/Toast/use-toast'
import { CONFIG } from '@/utils/config'
import { useCallback } from 'react'
import { useSafeCopy } from './clipboard'

export const useCopyMemberLoginLink = (organizationSlug: string) => {
  const safeCopy = useSafeCopy(toast)

  return useCallback(
    async (memberEmail: string) => {
      const link = `${CONFIG.FRONTEND_BASE_URL}/${organizationSlug}/portal/request?email=${encodeURIComponent(
        memberEmail,
      )}`
      await safeCopy(link)
      toast({
        title: 'Login link copied',
        description:
          'Share it with the member to sign in to the customer portal.',
      })
    },
    [organizationSlug, safeCopy],
  )
}
