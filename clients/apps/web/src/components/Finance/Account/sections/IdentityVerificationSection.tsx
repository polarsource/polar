'use client'

import IdentityStep from '@/components/Finance/Steps/IdentityStep'
import { useStartIdentityVerification } from '@/hooks/identityVerification'

export const IdentityVerificationSection = () => {
  const { start, identityVerificationStatus } = useStartIdentityVerification()

  return (
    <IdentityStep
      identityVerificationStatus={identityVerificationStatus}
      onStartIdentityVerification={start}
    />
  )
}
