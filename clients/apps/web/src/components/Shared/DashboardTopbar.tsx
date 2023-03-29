import { Cog8ToothIcon } from '@heroicons/react/24/outline'
import AccountTopbar from 'components/Dashboard/Account/Topbar'
import RepoSelection from 'components/Dashboard/RepoSelection'
import Link from 'next/link'
import { useRouter } from 'next/router'
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
          className="h-6 w-6 cursor-pointer text-gray-400 transition-colors duration-100 hover:text-gray-800"
          aria-hidden="true"
        />
      </Link>
    </>
  )
}

const DashboardNav = () => {
  const isOrganizationAccount = useStore((state) => state.isOrganizationAccount)
  const router = useRouter()
  const currentOrg = useStore((state) => state.currentOrg)

  return (
    <>
      <RepoSelection
        showRepositories={true}
        showConnectMore={true}
        onSelectOrg={(org) => router.push(`/dashboard/${org}`)}
        onSelectRepo={(org, repo) => router.push(`/dashboard/${org}/${repo}`)}
      />

      {isOrganizationAccount && currentOrg && <AccountTopbar />}

      {!isOrganizationAccount && <SettingsLink />}
      {isOrganizationAccount && currentOrg && (
        <SettingsLink orgSlug={currentOrg.name} />
      )}
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
