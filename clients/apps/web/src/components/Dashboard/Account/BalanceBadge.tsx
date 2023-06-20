import TopbarPill from '@/components/Shared/TopbarPill'
import { ArrowRightCircleIcon as SolidArrowRightCircleIcon } from '@heroicons/react/24/solid'
import { api } from 'polarkit'
import { AccountRead, Platforms } from 'polarkit/api/client'
import { useStore } from 'polarkit/store'
import { formatCurrencyAndAmount } from 'polarkit/utils'

const BalanceBadge = ({ account }: { account: AccountRead }) => {
  const currentOrg = useStore((store) => store.currentOrg)
  const visitDashboard = async () => {
    if (!currentOrg) {
      return
    }

    if (account.is_details_submitted) {
      const link = await api.accounts.dashboardLink({
        platform: Platforms.GITHUB,
        orgName: currentOrg.name,
        stripeId: account.stripe_id,
      })
      window.location.href = link.url
    }
  }

  if (!currentOrg || !account || account.balance === undefined) {
    return <></>
  }

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault()
        visitDashboard()
      }}
    >
      <TopbarPill color="blue" withIcon={true}>
        <>
          <span>
            {formatCurrencyAndAmount(
              account.balance_currency ?? 'usd',
              account.balance,
            )}
          </span>
          <SolidArrowRightCircleIcon
            className="-mr-10 h-6 w-6 text-blue-600 dark:text-blue-300"
            aria-hidden="true"
          />
        </>
      </TopbarPill>
    </a>
  )
}
export default BalanceBadge
