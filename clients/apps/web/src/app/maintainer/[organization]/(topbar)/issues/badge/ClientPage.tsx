'use client'

import { GitHubAppInstallationUpsell } from '@/components/Dashboard/Upsell'
import { EnableIssuesView } from '@/components/Issues/EnableIssuesView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import BadgeSetup from '@/components/Settings/Badge'
import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import { ReactElement } from 'react'

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
        <div className="dark:divide-polar-700 divide-y divide-gray-200">
          {org && (
            <Section>
              <>
                <SectionDescription title="Badge settings" />

                <BadgeSetup
                  org={org}
                  showControls={true}
                  setShowControls={() => true}
                  setSyncIssuesCount={(_: number) => true}
                  isSettingPage={true}
                />
              </>
            </Section>
          )}
        </div>
      </div>
    </DashboardBody>
  )
}

const Section = ({ children }: { children: ReactElement }) => {
  return <div className="mb-4 flex flex-col space-y-4 pt-4">{children}</div>
}

const SectionDescription = ({ title }: { title: string }) => {
  return (
    <h2 className="text-lg font-medium text-gray-950 dark:text-white">
      {title}
    </h2>
  )
}
