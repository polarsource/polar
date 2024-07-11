'use client'

import AccessTokensSettings from '@/components/Settings/AccessTokensSettings'
import AuthenticationSettings from '@/components/Settings/AuthenticationSettings'
import ConnectedAppSettings from '@/components/Settings/ConnectedAppSettings'
import GeneralSettings from '@/components/Settings/GeneralSettings'
import OAuthSettings from '@/components/Settings/OAuth/OAuthSettings'
import PaymentMethodSettings from '@/components/Settings/PaymentMethodSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import WebhookNotificationSettings from '@/components/Settings/Webhook/WebhookNotificationSettings'
import WebhookSettings from '@/components/Settings/Webhook/WebhookSettings'
import { useListAdminOrganizations } from '@/hooks/queries'
import { Separator } from 'polarkit/components/ui/separator'

export default function Page() {
  const orgs = useListAdminOrganizations()

  const org = orgs.data?.items?.find((o) => o.is_personal)

  return (
    <div className="relative z-0">
      <div className="mb-24 flex flex-col gap-y-8">
        <h1 className="text-2xl">Settings</h1>
        <div className="flex flex-col gap-y-4">
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
        </div>

        <div className="flex flex-col gap-y-6">
          <h2 className="text-xl">Developer Settings</h2>
          <Separator className="dark:bg-polar-600" />
        </div>

        <div className="flex flex-col gap-y-4">
          <Section id="pat">
            <SectionDescription
              title="Personal Access Tokens"
              description="Manage access tokens which can be used to authenticate you with the Polar API."
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

          <Section id="oauth">
            <SectionDescription
              title="OAuth Applications"
              description="Your configured OAuth Applications."
            />

            <OAuthSettings />
          </Section>
        </div>
      </div>
    </div>
  )
}
