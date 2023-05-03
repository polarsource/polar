import { Cog8ToothIcon } from '@heroicons/react/24/outline'
import AccountTopbar from 'components/Dashboard/Account/Topbar'
import RepoSelection from 'components/Dashboard/RepoSelection'
import SetupAccount from 'components/Dashboard/SetupAccount'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useStore } from 'polarkit/store'
import { useState } from 'react'
import Topbar from './Topbar'

const SettingsLink = ({ orgSlug }: { orgSlug?: string }) => {
  let path = '/settings'
  if (orgSlug) {
    path += `/${orgSlug}`
  }

  return (
    <>
      <Link href={path}>
        <Cog8ToothIcon
          className="h-6 w-6 cursor-pointer text-gray-500 transition-colors duration-100 hover:text-gray-900"
          aria-hidden="true"
        />
      </Link>
    </>
  )
}

const DashboardNav = ({
  showSetupAccount,
}: {
  showSetupAccount: (_: boolean) => void
}) => {
  const router = useRouter()
  const currentOrg = useStore((state) => state.currentOrg)
  const currentRepo = useStore((state) => state.currentRepo)

  if (!currentOrg) {
    return <></>
  }

  return (
    <>
      <RepoSelection
        showRepositories={true}
        showConnectMore={true}
        onSelectOrg={(org) => router.push(`/dashboard/${org}`)}
        onSelectRepo={(org, repo) => router.push(`/dashboard/${org}/${repo}`)}
        onSelectUser={() => router.push('/dashboard/personal')}
        currentOrg={currentOrg}
        currentRepo={currentRepo}
        showUserInDropdown={true}
        showOrganizationRepositoryCount={true}
      />
      <AccountTopbar showSetupAccount={showSetupAccount} />
      <SettingsLink orgSlug={currentOrg.name} />
    </>
  )
}

const PersonalDashboardNav = () => {
  const router = useRouter()
  return (
    <>
      <RepoSelection
        showRepositories={true}
        showConnectMore={true}
        onSelectOrg={(org) => router.push(`/dashboard/${org}`)}
        onSelectRepo={(org, repo) => router.push(`/dashboard/${org}/${repo}`)}
        onSelectUser={() => router.push('/dashboard/personal')}
        currentOrg={undefined}
        currentRepo={undefined}
        showUserInDropdown={true}
        defaultToUser={true}
        showOrganizationRepositoryCount={true}
      />
      <SettingsLink />
    </>
  )
}

const DashboardTopbar = () => {
  const [showSetupAccount, setShowSetupAccount] = useState(false)
  return (
    <>
      {showSetupAccount && (
        <SetupAccount onClose={() => setShowSetupAccount(false)} />
      )}
      <Topbar isFixed={true}>
        {{
          left: <DashboardNav showSetupAccount={setShowSetupAccount} />,
        }}
      </Topbar>
    </>
  )
}

export const PersonalDashboardTopbar = () => {
  return (
    <Topbar isFixed={true}>
      {{
        left: <PersonalDashboardNav />,
      }}
    </Topbar>
  )
}

export default DashboardTopbar
