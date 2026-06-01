import AuthenticationSettings from '@/components/Settings/AuthenticationSettings'
import GeneralSettings from '@/components/Settings/GeneralSettings'
import IdentityVerificationSettings from '@/components/Settings/IdentityVerificationSettings'
import { NotificationRecipientsSettings } from '@/components/Settings/NotificationRecipientsSettings'
import PersonalInformationSettings from '@/components/Settings/PersonalInformationSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import TwoFactorSettings from '@/components/Settings/TwoFactorSettings'
import UserDeleteSettings from '@/components/Settings/UserDeleteSettings'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Preferences',
  description: 'Manage your account preferences',
}

export default function Page() {
  return (
    <>
      <Section>
        <SectionDescription title="Personal Information" />
        <PersonalInformationSettings />
      </Section>
      <Section>
        <SectionDescription
          title="Identity Verification"
          description="Confirm your identity with a government-issued ID."
        />
        <IdentityVerificationSettings />
      </Section>
      <Section>
        <SectionDescription title="General" />
        <GeneralSettings />
      </Section>
      <Section>
        <SectionDescription title="Authentication Methods" />
        <AuthenticationSettings />
      </Section>
      <Section>
        <SectionDescription title="Two-Factor Authentication" />
        <TwoFactorSettings />
      </Section>
      <Section>
        <SectionDescription
          title="Notification Recipients"
          description="Manage the devices which receive notifications"
        />
        <NotificationRecipientsSettings />
      </Section>
      <Section>
        <SectionDescription
          title="Danger Zone"
          description="Irreversible actions for your account"
        />
        <UserDeleteSettings />
      </Section>
    </>
  )
}
