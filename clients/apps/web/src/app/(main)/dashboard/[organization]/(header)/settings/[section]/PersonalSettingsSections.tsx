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
import { useUserOrganizationNotificationSettings } from '@/hooks/queries/user_organizations'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'

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

export const DeveloperSettings = () => (
  <>
    <SettingsSection title="OAuth applications">
      <OAuthSettings />
    </SettingsSection>
    <SettingsSection title="Personal access tokens">
      <AccessTokensSettings />
    </SettingsSection>
  </>
)
