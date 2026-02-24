import AuthenticationSettings from '@/components/Settings/AuthenticationSettings'
import GeneralSettings from '@/components/Settings/GeneralSettings'
import { NotificationRecipientsSettings } from '@/components/Settings/NotificationRecipientsSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
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
        <SectionDescription
          title="General"
          description="Configure the general settings for your account"
        />
        <GeneralSettings />
      </Section>
      <Section>
        <SectionDescription
          title="Account Connections"
          description="Manage third-party connections to your account"
        />
        <AuthenticationSettings />
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
