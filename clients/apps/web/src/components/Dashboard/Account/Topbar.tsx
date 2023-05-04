import BalanceBadge from 'components/Dashboard/Account/BalanceBadge'
import StripeOnboardingButton from 'components/Dashboard/Account/StripeOnboardingButton'
import { useOrganizationAccounts } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import BalanceBadgeBox from './BalanceBadgeBox'

const AccountTopbar = ({
  showSetupAccount,
}: {
  showSetupAccount: (_: boolean) => void
}) => {
  const currentOrg = useStore((state) => state.currentOrg)
  const accountQuery = useOrganizationAccounts(currentOrg?.name)
  const accounts = accountQuery.data

  if (accountQuery.isLoading) {
    return (
      <BalanceBadgeBox>
        <div className="h-6 w-14"></div>
      </BalanceBadgeBox>
    )
  }

  if (accounts?.length === 1) {
    return (
      <>
        {!accounts[0].is_details_submitted && accounts[0].is_admin ? (
          <StripeOnboardingButton
            stripeId={accounts[0].stripe_id}
            showSetupAccount={showSetupAccount}
          />
        ) : (
          <BalanceBadge account={accounts[0]} />
        )}
      </>
    )
  }

  return <StripeOnboardingButton showSetupAccount={showSetupAccount} />
}
export default AccountTopbar
