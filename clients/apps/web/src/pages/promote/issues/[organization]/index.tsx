import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import BadgeSetup from '@/components/Settings/Badge'
import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useStore } from 'polarkit/store'
import { ReactElement, useEffect, useRef } from 'react'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
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
    <>
      <Head>
        <title>Polar | Promote {org?.name} issues</title>
      </Head>

      <DashboardLayout>
        <>
          <div className="relative z-0">
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {org && (
                <Section>
                  <>
                    <SectionDescription
                      title="Polar badge"
                      description="Customize which issues Polar should embed a pledge badge for."
                    />

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
        </>
      </DashboardLayout>
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return (
    <Gatekeeper>
      <>{page}</>
    </Gatekeeper>
  )
}

const Section = ({ children }: { children: ReactElement }) => {
  return (
    <div className="mb-4 flex flex-col space-y-4 pt-4 xl:flex-row-reverse xl:space-y-0">
      {children}
    </div>
  )
}

const SectionDescription = ({
  title,
  description,
}: {
  title: string
  description: string
}) => {
  return (
    <div className="flex-shrink-0 xl:ml-8 xl:w-60">
      <h2 className="mb-2 font-medium">{title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  )
}

export default Page
