import { Cog8ToothIcon } from '@heroicons/react/24/outline'
import StripeOnboardingButton from 'components/Shared/StripeOnboardingButton'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useOrganizationAccounts } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import BalanceBadge from '../Dashboard/BalanceBadge'
import RepoSelection from '../Dashboard/RepoSelection'
import Topbar from './Topbar'

const DashboardNav = () => {
  const currentOrg = useStore((state) => state.currentOrg)
  const accountQuery = useOrganizationAccounts(currentOrg?.name)
  const accounts = accountQuery.data
  const router = useRouter()

  return (
    <>
      <RepoSelection
        showRepositories={true}
        showConnectMore={true}
        onSelectOrg={(org) => router.push(`/dashboard/${org}`)}
        onSelectRepo={(org, repo) => router.push(`/dashboard/${org}/${repo}`)}
      />

      {accountQuery.isLoading ? (
        <p>Loading...</p>
      ) : accounts.length === 1 ? (
        <>
          <BalanceBadge account={accounts[0]} />
          {!accounts[0].is_details_submitted && accounts[0].is_admin && (
            <StripeOnboardingButton stripeId={accounts[0].stripe_id} />
          )}
        </>
      ) : (
        <StripeOnboardingButton />
      )}

      {currentOrg && (
        <Link href={`/settings/${currentOrg.name}`}>
          <Cog8ToothIcon
            className="h-6 w-6 cursor-pointer text-gray-400 transition-colors duration-100 hover:text-gray-800"
            aria-hidden="true"
          />
        </Link>
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
