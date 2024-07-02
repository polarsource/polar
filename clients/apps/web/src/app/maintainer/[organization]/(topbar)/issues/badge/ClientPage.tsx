'use client'

import { GitHubAppInstallationUpsell } from '@/components/Dashboard/Upsell'
import { EnableIssuesView } from '@/components/Issues/EnableIssuesView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import BadgeSetup from '@/components/Settings/Badge'
import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  if (!org && isLoaded) {
    return (
      <>
        <div className="mx-auto mt-32 flex max-w-[1100px] flex-col items-center">
          <span>Organization not found</span>
          <span>404 Not Found</span>
        </div>
      </>
    )
  }

  if (org && !org.feature_settings?.issue_funding_enabled) {
    return <EnableIssuesView organization={org} />
  }

  return (
    <DashboardBody>
      <div className="relative z-0">
        {!org?.has_app_installed && <GitHubAppInstallationUpsell />}
        <div className="dark:divide-polar-700 divide-gray-200">
          {org && (
            <BadgeSetup
              org={org}
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
