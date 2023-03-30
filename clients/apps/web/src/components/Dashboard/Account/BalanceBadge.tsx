import { ArrowRightCircleIcon as SolidArrowRightCircleIcon } from '@heroicons/react/24/solid'
import { api } from 'polarkit'
import { AccountRead, Platforms } from 'polarkit/api/client'
import { useStore } from 'polarkit/store'
import { getCentsInDollarString } from 'polarkit/utils'
import BalanceBadgeBox from './BalanceBadgeBox'

const BalanceBadge = ({ account }: { account: AccountRead }) => {
  const currentOrg = useStore((store) => store.currentOrg)
  const visitDashboard = async () => {
    if (account.is_details_submitted) {
      const link = await api.accounts.dashboardLink({
        platform: Platforms.GITHUB,
        orgName: currentOrg.name,
        stripeId: account.stripe_id,
      })
      window.location.href = link.url
    }
  }

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault()
        visitDashboard()
      }}
    >
      <BalanceBadgeBox withIcon={true}>
        <>
          <span>${getCentsInDollarString(account.balance)}</span>
          <SolidArrowRightCircleIcon
            className="-mr-10 h-6 w-6 text-[#9171D9]"
            aria-hidden="true"
          />
        </>
      </BalanceBadgeBox>
    </a>
  )
}
export default BalanceBadge
