import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import RepoSelection from '@/components/Dashboard/RepoSelection'
import EmptyLayout from '@/components/Layout/EmptyLayout'
import BadgeSetup from '@/components/Settings/Badge'
import NotificationSettings from '@/components/Settings/NotificationSettings'
import Topbar from '@/components/Shared/Topbar'
import { useRequireAuth } from '@/hooks/auth'
import { ArrowLeftIcon } from '@heroicons/react/24/solid'
import { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useOrganization, useUserOrganizations } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { ReactElement, useEffect, useMemo, useRef } from 'react'

const SettingsPage: NextLayoutComponentType = () => {
  const router = useRouter()
  const { organization } = router.query
  const handle: string = typeof organization === 'string' ? organization : ''
  const orgData = useOrganization(handle !== 'personal' ? handle : '')
  const org = orgData.data

  const didFirstSetForOrg = useRef<string>('')
  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)

  const { currentUser } = useRequireAuth()

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

  const showOrgSettings = useMemo(() => {
    return orgData.data && handle !== 'personal'
  }, [orgData, handle])

  const showPersonalSettings = useMemo(() => {
    return handle === 'personal' || handle === currentUser?.username
  }, [handle, currentUser])

  const showBadgeSettings = useMemo(() => {
    return showOrgSettings
  }, [showOrgSettings])

  const showEmailPreferences = useMemo(() => {
    return showPersonalSettings
  }, [showPersonalSettings])

  if (orgData.isError && !showPersonalSettings) {
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
        {showPersonalSettings && <title>Polar | Settings</title>}
        {!showPersonalSettings && <title>Polar | Settings for {handle}</title>}
      </Head>

      <div className="relative z-0 mx-auto w-full max-w-[1100px] md:mt-16">
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {showBadgeSettings && org && (
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

          {showEmailPreferences && (
            <Section>
              <>
                <SectionDescription
                  title="Email notifications"
                  description="Polar will send emails for the notifications enabled below."
                />

                <NotificationSettings />
              </>
            </Section>
          )}
        </div>
      </div>
    </>
  )
}

const SettingsTopbar = () => {
  const router = useRouter()
  const { organization } = router.query
  const handle: string = typeof organization === 'string' ? organization : ''

  const currentOrg = useStore((state) => state.currentOrg)

  const { currentUser } = useRequireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)

  if (!currentUser || !userOrgQuery.data) {
    return <></>
  }

  return (
    <Topbar isFixed={true}>
      {{
        left: (
          <Link href={`/dashboard/${handle}`}>
            <ArrowLeftIcon className="h-6 w-6" />
          </Link>
        ),
        center: (
          <div className="flex items-center space-x-2 text-sm">
            <div>Settings for</div>
            <RepoSelection
              showRepositories={false}
              showConnectMore={false}
              currentOrg={currentOrg}
              onSelectOrg={(org) => router.push(`/settings/${org}`)}
              onSelectUser={() => router.push(`/settings/personal`)}
              currentUser={currentUser}
              organizations={userOrgQuery.data}
              defaultToUser={true}
              showUserInDropdown={true}
            />
          </div>
        ),
      }}
    </Topbar>
  )
}

SettingsPage.getLayout = (page: ReactElement) => {
  return (
    <Gatekeeper>
      <EmptyLayout>
        <>
          <SettingsTopbar />
          {page}
        </>
      </EmptyLayout>
    </Gatekeeper>
  )
}

const Section = ({ children }: { children: ReactElement }) => {
  return (
    <div className="flex flex-col space-y-4 p-4 py-10 md:flex-row md:space-x-20 md:space-y-0">
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
    <div className="flex-shrink-0 md:w-60">
      <h2 className="mb-2 font-medium">{title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  )
}

export default SettingsPage
