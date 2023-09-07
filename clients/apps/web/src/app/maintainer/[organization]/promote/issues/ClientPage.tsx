'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import BadgeSetup from '@/components/Settings/Badge'
import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import { useStore } from 'polarkit/store'
import { ReactElement, useEffect, useRef } from 'react'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()
  const didFirstSetForOrg = useRef<string>('')
  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)

  useEffect(() => {
    if (!org) {
      return
    }

    setCurrentOrgRepo(org, undefined)

    // If org changes, or if this is the first time we load this org, build states
    if (didFirstSetForOrg.current === org.id) {
      return
    }

    didFirstSetForOrg.current = org.id
  }, [org, setCurrentOrgRepo])

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
    <DashboardBody>
      <div className="relative z-0">
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
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
  )
}

const Section = ({ children }: { children: ReactElement }) => {
  return <div className="mb-4 flex flex-col space-y-4 pt-4">{children}</div>
}

const SectionDescription = ({ title }: { title: string }) => {
  return <h2 className="text-lg text-gray-500 dark:text-gray-400">{title}</h2>
}
