'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import BadgeSetup from '@/components/Settings/Badge'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'
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

  return (
    <>
      <DashboardTopbar isFixed useOrgFromURL />
      <DashboardBody>
        <div className="relative z-0">
          <div className="dark:divide-polar-700 divide-y divide-gray-200">
            {org && (
              <Section>
                <>
                  <SectionDescription title="Badge settings" />

                  <BadgeSetup
                    org={org}
                    showControls={true}
                    setShowControls={() => true}
                    setSyncIssuesCount={(value: number) => true}
                    isSettingPage={true}
                  />
                </>
              </Section>
            )}
          </div>
        </div>
      </DashboardBody>
    </>
  )
}

const Section = ({ children }: { children: ReactElement }) => {
  return <div className="mb-4 flex flex-col space-y-4 pt-4">{children}</div>
}

const SectionDescription = ({ title }: { title: string }) => {
  return (
    <h2 className="dark:text-polar-50 text-lg font-medium text-gray-950">
      {title}
    </h2>
  )
}
