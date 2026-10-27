'use client'

import { IdentityVerificationStatusContent } from '@/components/Identity/IdentityVerificationStatusContent'
import { useStartIdentityVerification } from '@/hooks/identityVerification'
import { SettingsGroup, SettingsGroupRow } from './SettingsGroup'

const IdentityVerificationSettings = () => {
  const { start, identityVerificationStatus } = useStartIdentityVerification()

  return (
    <SettingsGroup>
      <SettingsGroupRow>
        <IdentityVerificationStatusContent
          status={identityVerificationStatus}
          onStart={start}
          unverifiedDescription="Verify your identity using a government-issued ID to confirm your account."
        />
      </SettingsGroupRow>
    </SettingsGroup>
  )
}

export default IdentityVerificationSettings
