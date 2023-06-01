import {
  OrganizationPrivateRead,
  Platforms,
} from '@/../../../packages/polarkit/src/api/client'
import { serversideAPI } from '@/api'
import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import RepoSelection from '@/components/Dashboard/RepoSelection'
import EmptyLayout from '@/components/Layout/EmptyLayout'
import BadgeSetup from '@/components/Settings/Badge'
import NotificationSettings from '@/components/Settings/NotificationSettings'
import Topbar from '@/components/Shared/Topbar'
import { useRequireAuth } from '@/hooks/auth'
import { ArrowLeftIcon } from '@heroicons/react/24/solid'
import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useUserOrganizations } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { ReactElement, useEffect, useRef, useState } from 'react'

export const getServerSideProps: GetServerSideProps<{
  showBadgeSettings: boolean
  showEmailPreferences: boolean
  isPersonal: boolean
  org: OrganizationPrivateRead | null
}> = async (context) => {
  const api = serversideAPI(context)

  const user = await api.users.getAuthenticated()

  const handle: string =
    typeof context?.params?.organization === 'string'
      ? context?.params?.organization
      : ''

  const isPersonal = handle === 'personal'

  const showEmailPreferences = isPersonal || handle === user.username

  let org: OrganizationPrivateRead | null = null

  if (!isPersonal) {
    try {
      org = await api.organizations.getWithRepositories({
        platform: Platforms.GITHUB,
        orgName: handle,
      })
    } catch (Exception) {}
  }

  return {
    props: {
      showBadgeSettings: !isPersonal,
      showEmailPreferences,
      isPersonal,
      org,
    },
  }
}

const SettingsPage = ({
  showBadgeSettings,
  showEmailPreferences,
  isPersonal,
  org,
}: {
  showBadgeSettings: boolean
  showEmailPreferences: boolean
  isPersonal: boolean
  org: OrganizationPrivateRead | null
}) => {
  const router = useRouter()
  const { organization } = router.query

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

  if (!org && !isPersonal) {
    return (
      <>
        <div className="mx-auto mt-32 flex max-w-[1100px] flex-col items-center">
          <span>Organization not found</span>
          <span>404 Not Found</span>
        </div>
      </>
    )
  }

  console.log('org', org)

  return (
    <>
      <Head>
        {isPersonal && <title>Polar | Settings</title>}
        {!isPersonal && org && <title>Polar | Settings for {org.name}</title>}
      </Head>

      <div className="relative z-0 mx-auto w-full max-w-[1100px] md:mt-16">
        <div className="divide-y divide-gray-200">
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

  // TODO: make use of serverside props instead, and we wouldn't need this workaround
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(true)
  })

  if (!ready) {
    return <></>
  }

  if (!currentUser || !userOrgQuery.data) {
    return <></>
  }

  return (
    <Topbar isFixed={true}>
      {{
        left: (
          <Link href={`/dashboard/${handle}`}>
            <ArrowLeftIcon className="h-6 w-6 text-black" />
          </Link>
        ),
        center: (
          <div className="flex items-center space-x-2 text-sm">
            <div>Settings for</div>
            <RepoSelection
              showRepositories={false}
              showConnectMore={false}
              currentOrg={currentOrg}
              onSelectOrg={(org) => router.push(`/dashboard/settings/${org}`)}
              onSelectUser={() => router.push(`/dashboard/settings/personal`)}
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
      <h2 className="mb-2 font-medium text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  )
}

export default SettingsPage
