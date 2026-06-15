'use client'

import { IdentityVerificationStatusContent } from '@/components/Identity/IdentityVerificationStatusContent'
import { useStartIdentityVerification } from '@/hooks/identityVerification'
import { getQueryClient } from '@/utils/api/query'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useRef } from 'react'
import { PathCardBanner } from './PathCardBanner'

interface Props {
  organization: schemas['Organization']
  step: schemas['OrganizationReviewCheck']
  reasonItems: string[]
}

export const IdentityVerificationSection = ({
  organization,
  step,
  reasonItems,
}: Props) => {
  const { start, identityVerificationStatus } = useStartIdentityVerification()

  const isInitialRef = useRef(true)
  useEffect(() => {
    if (isInitialRef.current) {
      isInitialRef.current = false
      return
    }
    getQueryClient().invalidateQueries({
      queryKey: ['organizationReviewState', organization.id],
    })
  }, [identityVerificationStatus, organization.id])

  const tone = step.status === 'failed' ? 'danger' : 'warning'
  const showBanners =
    reasonItems.length > 0 &&
    (identityVerificationStatus === 'failed' ||
      identityVerificationStatus === 'unverified' ||
      !identityVerificationStatus)

  return (
    <>
      <IdentityVerificationStatusContent
        status={identityVerificationStatus}
        onStart={start}
      />
      {showBanners && (
        <Box flexDirection="column" rowGap="m">
          {reasonItems.map((reason) => (
            <PathCardBanner key={reason} tone={tone} title={reason} />
          ))}
        </Box>
      )}
    </>
  )
}
