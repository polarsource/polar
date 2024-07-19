'use client'

import { GitHubAppInstallationUpsell } from '@/components/Dashboard/Upsell'
import { EnableIssuesView } from '@/components/Issues/EnableIssuesView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import BadgeSetup from '@/components/Settings/Badge'
import { useHasLinkedExternalOrganizations } from '@/hooks'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { useContext } from 'react'

export default function ClientPage() {
  const { organization } = useContext(MaintainerOrganizationContext)
  const hasLinkedExternalOrganizations =
    useHasLinkedExternalOrganizations(organization)

  if (organization && !organization.feature_settings?.issue_funding_enabled) {
    return <EnableIssuesView organization={organization} />
  }

  return (
    <DashboardBody>
      <div className="relative z-0">
        {organization && !hasLinkedExternalOrganizations && (
          <GitHubAppInstallationUpsell organization={organization} />
        )}
        <div className="dark:divide-polar-700 divide-gray-200">
          {organization && (
            <BadgeSetup
              org={organization}
              showControls={true}
              setShowControls={() => true}
              setSyncIssuesCount={(_: number) => true}
              isSettingPage={true}
            />
          )}
        </div>
      </div>
    </DashboardBody>
  )
}
