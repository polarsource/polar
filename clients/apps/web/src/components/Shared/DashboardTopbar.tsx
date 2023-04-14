import { Cog8ToothIcon } from '@heroicons/react/24/outline'
import AccountTopbar from 'components/Dashboard/Account/Topbar'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { RepoSelection } from 'polarkit/components'
import { useStore } from 'polarkit/store'
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

const DashboardNav = () => {
  const userHaveOrgs = useStore((state) => state.userHaveOrgs)
  const router = useRouter()
  const currentOrg = useStore((state) => state.currentOrg)
  const currentRepo = useStore((state) => state.currentRepo)

  return (
    <>
      <RepoSelection
        showRepositories={true}
        showConnectMore={true}
        onSelectOrg={(org) => router.push(`/dashboard/${org}`)}
        onSelectRepo={(org, repo) => router.push(`/dashboard/${org}/${repo}`)}
        currentOrg={currentOrg}
        currentRepo={currentRepo}
        showUserInDropdownFallback={true}
      />

      {currentOrg && <AccountTopbar />}

      {!currentOrg && <SettingsLink />}
      {currentOrg && <SettingsLink orgSlug={currentOrg.name} />}
    </>
  )
}

const DashboardTopbar = () => {
  return (
    <Topbar isFixed={true}>
      {{
        left: <DashboardNav />,
      }}
    </Topbar>
  )
}

export default DashboardTopbar
