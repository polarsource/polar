'use client'

import { ManagedAsCodeBadge } from '@/components/Dashboard/ManagedAsCodeBadge'
import AccessRestricted from '@/components/Finance/AccessRestricted'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import FeatureSettings from '@/components/Settings/FeatureSettings'
import OrganizationAccessTokensSettings from '@/components/Settings/OrganizationAccessTokensSettings'
import OrganizationCustomerEmailSettings from '@/components/Settings/OrganizationCustomerEmailSettings'
import OrganizationCustomerPortalSettings from '@/components/Settings/OrganizationCustomerPortalSettings'
import OrganizationDisputeSettings from '@/components/Settings/OrganizationDisputeSettings'
import OrganizationDomainsSettings from '@/components/Settings/OrganizationDomainsSettings'
import OrganizationEmbedSettings from '@/components/Settings/OrganizationEmbedSettings'
import OrganizationPaymentSettings from '@/components/Settings/OrganizationPaymentSettings'
import OrganizationSubscriptionSettings from '@/components/Settings/OrganizationSubscriptionSettings'
import {
  SETTINGS_SECTIONS,
  SettingsSectionSlug,
} from '@/components/Settings/settingsSections'
import { useHasPermission, useIsManagedAsCode } from '@/hooks/permissions'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import {
  DeveloperSettings,
  NotificationsSettings,
  ProfileSettings,
  SecuritySettings,
} from './PersonalSettingsSections'

const SectionContent = ({
  section,
  organization,
  readOnly,
}: {
  section: SettingsSectionSlug
  organization: schemas['Organization']
  readOnly: boolean
}) => {
  switch (section) {
    case 'payments':
      return (
        <OrganizationPaymentSettings
          organization={organization}
          readOnly={readOnly}
        />
      )
    case 'subscriptions':
      return (
        <OrganizationSubscriptionSettings
          organization={organization}
          readOnly={readOnly}
        />
      )
    case 'disputes':
      return (
        <OrganizationDisputeSettings
          organization={organization}
          readOnly={readOnly}
        />
      )
    case 'customer-portal':
      return (
        <OrganizationCustomerPortalSettings
          organization={organization}
          readOnly={readOnly}
        />
      )
    case 'customer-notifications':
      return (
        <>
          {CONFIG.IS_SANDBOX && (
            <Alert
              variant="warning"
              title="Sandbox notice"
              description={
                <>
                  In sandbox, customer-facing emails are only delivered to{' '}
                  <Link
                    href={`/dashboard/${organization.slug}/settings/members`}
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
            organization={organization}
            readOnly={readOnly}
          />
        </>
      )
    case 'embedding':
      return (
        <OrganizationEmbedSettings
          organization={organization}
          readOnly={readOnly}
        />
      )
    case 'domains':
      return readOnly ? (
        <AccessRestricted message="You don't have permission to manage domains for this organization." />
      ) : (
        <OrganizationDomainsSettings organization={organization} />
      )
    case 'access-tokens':
      return readOnly ? (
        <AccessRestricted message="You don't have permission to manage access tokens for this organization. Ask an admin if you need access." />
      ) : (
        <OrganizationAccessTokensSettings organization={organization} />
      )
    case 'features':
      return (
        <>
          {CONFIG.IS_SANDBOX && (
            <Alert
              title="Preview features in sandbox"
              description={
                <>
                  To enable paid access to preview features in sandbox, go to{' '}
                  <Link
                    href={`/dashboard/${organization.slug}/settings/billing`}
                    className="font-medium underline hover:no-underline"
                  >
                    Settings → Billing
                  </Link>
                  .
                </>
              }
            />
          )}
          <FeatureSettings organization={organization} readOnly={readOnly} />
        </>
      )
    case 'notifications':
      return <NotificationsSettings organization={organization} />
    case 'profile':
      return <ProfileSettings />
    case 'security':
      return <SecuritySettings />
    case 'developer':
      return <DeveloperSettings />
  }
}

export default function SettingsSectionPage({
  organization,
  section,
}: {
  organization: schemas['Organization']
  section: SettingsSectionSlug
}) {
  const canManageOrganization = useHasPermission(
    organization.id,
    'organization:manage',
  )
  const managedAsCode = useIsManagedAsCode(organization.id)

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-md)!"
      title={SETTINGS_SECTIONS[section].title}
    >
      <Box flexDirection="column" rowGap="2xl">
        {section === 'payments' && managedAsCode && (
          <Box>
            <ManagedAsCodeBadge />
          </Box>
        )}
        <SectionContent
          section={section}
          organization={organization}
          readOnly={!canManageOrganization}
        />
      </Box>
    </DashboardBody>
  )
}
