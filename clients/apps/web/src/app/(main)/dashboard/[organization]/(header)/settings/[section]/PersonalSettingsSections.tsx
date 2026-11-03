'use client'

import AccessTokensSettings from '@/components/Settings/AccessTokenSettings'
import AuthenticationSettings from '@/components/Settings/AuthenticationSettings'
import GeneralSettings from '@/components/Settings/GeneralSettings'
import IdentityVerificationSettings from '@/components/Settings/IdentityVerificationSettings'
import { NotificationRecipientsSettings } from '@/components/Settings/NotificationRecipientsSettings'
import OAuthSettings from '@/components/Settings/OAuth/OAuthSettings'
import OrganizationNotificationSettings from '@/components/Settings/OrganizationNotificationSettings'
import PersonalInformationSettings from '@/components/Settings/PersonalInformationSettings'
import { SettingsSection } from '@/components/Settings/SettingsGroup'
import TwoFactorSettings from '@/components/Settings/TwoFactorSettings'
import UserDeleteSettings from '@/components/Settings/UserDeleteSettings'
import { usePersonalAccessTokens } from '@/hooks/queries'
import { useUserOrganizationNotificationSettings } from '@/hooks/queries/user_organizations'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { useState } from 'react'

export const NotificationsSettings = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { data: userNotificationSettings } =
    useUserOrganizationNotificationSettings(organization.id)

  return (
    <>
      <Alert
        title="These are your personal notifications"
        description="Changes here only apply to you. Other members of this organization keep their own settings."
      />
      {userNotificationSettings && (
        <SettingsSection title="Emails">
          <OrganizationNotificationSettings
            organization={organization}
            userNotificationSettings={userNotificationSettings}
          />
        </SettingsSection>
      )}
      <SettingsSection title="Devices">
        <NotificationRecipientsSettings />
      </SettingsSection>
    </>
  )
}

export const ProfileSettings = () => (
  <>
    <SettingsSection title="Personal information">
      <PersonalInformationSettings />
    </SettingsSection>
    <SettingsSection title="Identity verification">
      <IdentityVerificationSettings />
    </SettingsSection>
    <SettingsSection title="Appearance">
      <GeneralSettings />
    </SettingsSection>
    <UserDeleteSettings />
  </>
)

export const SecuritySettings = () => (
  <>
    <SettingsSection title="Authentication methods">
      <AuthenticationSettings />
    </SettingsSection>
    <SettingsSection title="Two-factor authentication">
      <TwoFactorSettings />
    </SettingsSection>
  </>
)

export const DeveloperSettings = () => {
  const { data: tokens } = usePersonalAccessTokens()
  const [now] = useState(() => Date.now())
  const hasTokens = !!tokens?.items.some(
    (token) => !token.expires_at || new Date(token.expires_at).getTime() > now,
  )

  return (
    <>
      <SettingsSection title={hasTokens ? 'OAuth apps' : undefined}>
        <OAuthSettings />
      </SettingsSection>
      {hasTokens && (
        <SettingsSection title="Personal access tokens">
          <AccessTokensSettings />
        </SettingsSection>
      )}
    </>
  )
}
