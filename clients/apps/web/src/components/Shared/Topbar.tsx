import { Cog8ToothIcon, CubeIcon } from '@heroicons/react/24/outline'
import StripeOnboardingButton from 'components/Shared/StripeOnboardingButton'
import { useOrganizationAccounts } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { classNames } from 'polarkit/utils/dom'
import BalanceBadge from '../Dashboard/BalanceBadge'
import RepoSelection from '../Dashboard/RepoSelection'
import Profile from './Profile'

const DashboardNav = () => {
  const currentOrg = useStore((state) => state.currentOrg)
  const accountQuery = useOrganizationAccounts(currentOrg.name)

  const accounts = accountQuery.data

  return (
    <>
      <RepoSelection />
      {accountQuery.isLoading ? (
        <p>Loading...</p>
      ) : accounts.length === 1 ? (
        accounts[0].is_details_submitted ? (
          <BalanceBadge balance={accounts[0].balance} />
        ) : (
          <StripeOnboardingButton stripeId={accounts[0].stripe_id} />
        )
      ) : (
        <StripeOnboardingButton />
      )}
      <Cog8ToothIcon
        className="h-6 w-6 cursor-pointer text-gray-400 transition-colors duration-100 hover:text-gray-800"
        aria-hidden="true"
      />
    </>
  )
}

const Topbar = (props: { isDashboard?: boolean }) => {
  const className = classNames(
    props.isDashboard ? 'fixed z-10' : '',
    'flex h-16 w-full items-center justify-between space-x-4 bg-white px-4 drop-shadow',
  )

  return (
    <>
      <div className={className}>
        <div className="flex items-center space-x-4 md:flex-1">
          {props.isDashboard && <DashboardNav />}
        </div>

        <div className="hidden flex-shrink-0 items-center space-x-2 font-semibold text-gray-700 md:inline-flex ">
          <CubeIcon className="h-6 w-6 " aria-hidden="true" />
          <span>Polar</span>
        </div>

        <div className="flex flex-shrink-0 justify-end space-x-4 md:flex-1">
          <Profile />
        </div>
      </div>
    </>
  )
}
export default Topbar
