'use client'

import AccessTokensSettings from '@/components/Settings/AccessTokensSettings'
import AuthenticationSettings from '@/components/Settings/AuthenticationSettings'
import GeneralSettings from '@/components/Settings/GeneralSettings'
import NotificationSettings from '@/components/Settings/NotificationSettings'
import PaymentMethodSettings from '@/components/Settings/PaymentMethodSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import SubscriptionSettings from '@/components/Settings/SubscriptionSettings'
import { Separator } from 'polarkit/components/ui/separator'

export default function Page() {
  return (
    <div className="relative z-0">
      <div className="dark:divide-polar-700 flex flex-col gap-y-4">
        <Section>
          <SectionDescription title="General" description="" />
          <GeneralSettings />
        </Section>

        <Separator />

        <Section>
          <SectionDescription
            title="Subscriptions"
            description="Manage your active subscriptions"
          />
          <SubscriptionSettings />
        </Section>

        <Separator />

        <Section>
          <SectionDescription title="Payment methods" />
          <PaymentMethodSettings />
        </Section>

        <Separator />

        <Section>
          <SectionDescription
            title="Signin connections"
            description="Connect external accounts for authenticating to Polar."
          />
          <AuthenticationSettings />
        </Section>

        <Separator />

        <Section>
          <SectionDescription
            title="Email notifications"
            description="Polar will send emails for the notifications enabled below."
          />
          <NotificationSettings />
        </Section>

        <Separator />

        <Section>
          <SectionDescription
            title="Access Tokens"
            description="Manage access tokens which can be used to authenticate you with the Polar SDK."
          />
          <AccessTokensSettings />
        </Section>
      </div>
    </div>
  )
}
