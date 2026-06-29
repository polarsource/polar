'use client'

import AccessRestricted from '@/components/Finance/AccessRestricted'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import FeatureSettings from '@/components/Settings/FeatureSettings'
import OrganizationAccessTokensSettings from '@/components/Settings/OrganizationAccessTokensSettings'
import OrganizationCustomerEmailSettings from '@/components/Settings/OrganizationCustomerEmailSettings'
import OrganizationCustomerPortalSettings from '@/components/Settings/OrganizationCustomerPortalSettings'
import OrganizationDeleteSettings from '@/components/Settings/OrganizationDeleteSettings'
import OrganizationNotificationSettings from '@/components/Settings/OrganizationNotificationSettings'
import OrganizationPaymentSettings from '@/components/Settings/OrganizationPaymentSettings'
import OrganizationProfileSettings from '@/components/Settings/OrganizationProfileSettings'
import OrganizationSubscriptionSettings from '@/components/Settings/OrganizationSubscriptionSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { useHasPermission } from '@/hooks/permissions'
import { useUserOrganizationNotificationSettings } from '@/hooks/queries/user_organizations'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import Link from 'next/link'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  const canManageOrganization = useHasPermission(org.id, 'organization:manage')
  const { data: userNotificationSettings } =
    useUserOrganizationNotificationSettings(org.id)

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-sm)!"
      title="Preferences"
    >
      <div className="flex flex-col gap-y-12">
        <Section id="organization">
          <SectionDescription title="Organization" />
          <OrganizationProfileSettings
            organization={org}
            readOnly={!canManageOrganization}
          />
        </Section>

        <Section id="payments">
          <SectionDescription title="Payments" />
          <OrganizationPaymentSettings
            organization={org}
            readOnly={!canManageOrganization}
          />
        </Section>

        <Section id="subscriptions">
          <SectionDescription title="Subscriptions" />
          <OrganizationSubscriptionSettings
            organization={org}
            readOnly={!canManageOrganization}
          />
        </Section>

        <Section id="customer_portal">
          <SectionDescription title="Customer portal" />
          <OrganizationCustomerPortalSettings
            organization={org}
            readOnly={!canManageOrganization}
          />
        </Section>

        <Section id="customer_emails">
          <SectionDescription
            title="Customer notifications"
            description="Emails automatically sent to customers for purchases, renewals, and other subscription lifecycle events"
          />
          {CONFIG.IS_SANDBOX && (
            <Alert
              variant="warning"
              title="Sandbox notice"
              description={
                <>
                  In sandbox, customer-facing emails are only delivered to{' '}
                  <Link
                    href="./members"
                    className="font-medium underline hover:no-underline"
                  >
                    members of your organization
                  </Link>
                  . Sub-addressing aliases like{' '}
                  <strong className="font-medium">you+test@example.com</strong>{' '}
                  are accepted.
                </>
              }
            />
          )}
          <OrganizationCustomerEmailSettings
            organization={org}
            readOnly={!canManageOrganization}
          />
        </Section>

        <Section id="account-notifications">
          <SectionDescription
            title="Your notifications"
            description="Choose which emails you receive as a member of this organization."
          />
          {userNotificationSettings && (
            <OrganizationNotificationSettings
              organization={org}
              userNotificationSettings={userNotificationSettings}
            />
          )}
        </Section>

        <Section id="features">
          <SectionDescription
            title="Features"
            description="Manage alpha & beta features for your organization"
          />
          {CONFIG.IS_SANDBOX && (
            <Alert
              title="Preview features in sandbox"
              description={
                <>
                  To enable paid access to preview features in sandbox, go to{' '}
                  <Link
                    href="./billing"
                    className="font-medium underline hover:no-underline"
                  >
                    Settings → Billing
                  </Link>
                  .
                </>
              }
            />
          )}
          <FeatureSettings
            organization={org}
            readOnly={!canManageOrganization}
          />
        </Section>

        <Section id="developers">
          <SectionDescription
            title="Developers"
            description="Manage access tokens to authenticate with the Polar API"
          />
          {canManageOrganization === false ? (
            <AccessRestricted message="You don't have permission to manage access tokens for this organization. Ask an admin if you need access." />
          ) : (
            <OrganizationAccessTokensSettings organization={org} />
          )}
        </Section>

        <Section id="danger">
          <SectionDescription
            title="Danger Zone"
            description="Irreversible actions for this organization"
          />
          {canManageOrganization === false ? (
            <AccessRestricted message="You don't have permission to delete this organization." />
          ) : (
            <OrganizationDeleteSettings organization={org} />
          )}
        </Section>
      </div>
    </DashboardBody>
  )
}
