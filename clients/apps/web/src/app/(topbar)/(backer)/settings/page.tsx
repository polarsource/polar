'use client'

import AccessTokensSettings from '@/components/Settings/AccessTokensSettings'
import AuthenticationSettings from '@/components/Settings/AuthenticationSettings'
import ConnectedAppSettings from '@/components/Settings/ConnectedAppSettings'
import GeneralSettings from '@/components/Settings/GeneralSettings'
import NotificationSettings from '@/components/Settings/NotificationSettings'
import { OAuthSettings } from '@/components/Settings/OAuth/OAuthSettings'
import PaymentMethodSettings from '@/components/Settings/PaymentMethodSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import WebhookNotificationSettings from '@/components/Settings/Webhook/WebhookNotificationSettings'
import WebhookSettings from '@/components/Settings/Webhook/WebhookSettings'
import { useListAdminOrganizations } from '@/hooks/queries'

export default function Page() {
  const orgs = useListAdminOrganizations()

  const org = orgs.data?.items?.find((o) => o.is_personal)

  return (
    <div className="relative z-0">
      <div className="dark:divide-polar-700 mb-24 flex flex-col gap-y-4">
        <Section>
          <SectionDescription title="General" description="" />
          <GeneralSettings />
        </Section>

        <Section>
          <SectionDescription
            title="Connected Apps"
            description="Manage connection to apps"
          />
          <ConnectedAppSettings />
        </Section>

        <Section>
          <SectionDescription title="Payment methods" />
          <PaymentMethodSettings />
        </Section>

        <Section>
          <SectionDescription
            title="Signin connections"
            description="Connect external accounts for authenticating to Polar."
          />
          <AuthenticationSettings />
        </Section>

        <Section>
          <SectionDescription
            title="Email notifications"
            description="Polar will send emails for the notifications enabled below."
          />
          <NotificationSettings />
        </Section>

        <Section>
          <SectionDescription
            title="Access Tokens"
            description="Manage access tokens which can be used to authenticate you with the Polar SDK."
          />
          <AccessTokensSettings />
        </Section>

        {org ? (
          <>
            <Section>
              <SectionDescription
                title="Discord + Slack Notifications"
                description={`Send a incoming webhook to Discord or Slack when ${org.name} gets a new pledge, subscription or donation.`}
              />

              <WebhookNotificationSettings org={org} />
            </Section>

            <Section>
              <SectionDescription
                title="Webhooks"
                description={`Configure and send webhooks to custom URLs.`}
              />

              <WebhookSettings org={org} />
            </Section>
          </>
        ) : null}

        <Section>
          <SectionDescription
            title="OAuth Applications"
            description="Your configured OAuth Applications."
          />

          <OAuthSettings />
        </Section>
      </div>
    </div>
  )
}
