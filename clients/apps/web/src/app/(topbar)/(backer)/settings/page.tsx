'use client'

import AccessTokensSettings from '@/components/Settings/AccessTokensSettings'
import AuthenticationSettings from '@/components/Settings/AuthenticationSettings'
import ConnectedAppSettings from '@/components/Settings/ConnectedAppSettings'
import GeneralSettings from '@/components/Settings/GeneralSettings'
import NotificationSettings from '@/components/Settings/NotificationSettings'
import PaymentMethodSettings from '@/components/Settings/PaymentMethodSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import WebhookNotificationSettings from '@/components/Settings/WebhookNotificationSettings'
import { useListAdminOrganizations } from '@/hooks/queries'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'

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

              <div className="flex w-full flex-col overflow-hidden">
                <Link href={`/maintainer/${org.name}/webhooks`}>
                  <Button asChild>Go to webhook settings</Button>
                </Link>
              </div>
            </Section>
          </>
        ) : null}
      </div>
    </div>
  )
}
