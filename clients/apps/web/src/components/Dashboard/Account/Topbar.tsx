import BalanceBadge from 'components/Dashboard/Account/BalanceBadge'
import StripeOnboardingButton from 'components/Dashboard/Account/StripeOnboardingButton'
import { useOrganizationAccounts } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import BalanceBadgeBox from './BalanceBadgeBox'

const AccountTopbar = () => {
  const currentOrg = useStore((state) => state.currentOrg)
  const accountQuery = useOrganizationAccounts(currentOrg?.name)
  const accounts = accountQuery.data
  return (
    <>
      {accountQuery.isLoading ? (
        <BalanceBadgeBox>
          <div className="w-8"></div>
        </BalanceBadgeBox>
      ) : accounts?.length === 1 ? (
        <>
          <BalanceBadge account={accounts[0]} />
          {!accounts[0].is_details_submitted && accounts[0].is_admin && (
            <StripeOnboardingButton stripeId={accounts[0].stripe_id} />
          )}
        </>
      ) : (
        <StripeOnboardingButton />
      )}
    </>
  )
}
export default AccountTopbar
