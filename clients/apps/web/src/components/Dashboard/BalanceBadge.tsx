import { ArrowRightCircleIcon as SolidArrowRightCircleIcon } from '@heroicons/react/24/solid'
import { api } from 'polarkit'
import { AccountRead, Platforms } from 'polarkit/api/client'
import { useStore } from 'polarkit/store'
import { getCentsInDollarString } from 'polarkit/utils'

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
      <div className="flex items-center space-x-3 rounded-full border-2 border-[#E5DEF5] bg-[#F9F7FD] py-1 pr-1.5 pl-3 text-[#7556BA] transition-colors duration-100 hover:bg-[#E5DEF5]">
        <span>${getCentsInDollarString(account.balance)}</span>
        <SolidArrowRightCircleIcon
          className="h-6 w-6 text-[#9171D9]"
          aria-hidden="true"
        />
      </div>
    </a>
  )
}
export default BalanceBadge
