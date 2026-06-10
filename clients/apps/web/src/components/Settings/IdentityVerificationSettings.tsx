'use client'

import { IdentityVerificationStatusContent } from '@/components/Identity/IdentityVerificationStatusContent'
import { useStartIdentityVerification } from '@/hooks/identityVerification'
import { Box } from '@polar-sh/orbit/Box'

const IdentityVerificationSettings = () => {
  const { start, identityVerificationStatus } = useStartIdentityVerification()

  return (
    <Box
      display="block"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      padding="l"
    >
      <IdentityVerificationStatusContent
        status={identityVerificationStatus}
        onStart={start}
        unverifiedDescription="Verify your identity using a government-issued ID to confirm your account."
      />
    </Box>
  )
}

export default IdentityVerificationSettings
