import { Account, Status } from '@polar-sh/sdk'
import { api } from 'polarkit'
import {
  ACCOUNT_STATUS_DISPLAY_NAMES,
  ACCOUNT_TYPE_DISPLAY_NAMES,
} from 'polarkit/account'
import Button from 'polarkit/components/ui/atoms/button'
import { twMerge } from 'tailwind-merge'
import AccountAssociations from './AccountAssociations'

interface AccountsListProps {
  accounts: Account[]
  returnPath: string
}

const AccountsList = ({ accounts, returnPath }: AccountsListProps) => {
  return (
    <table className="-mx-4 w-full text-left">
      <thead className="dark:text-polar-500 text-gray-500">
        <tr className="text-sm">
          <th
            scope="col"
            className="relative isolate whitespace-nowrap px-4 py-3.5 pr-2 text-left font-normal"
          >
            Type
          </th>
          <th
            scope="col"
            className="relative isolate whitespace-nowrap px-4 py-3.5 pr-2 text-left font-normal"
          >
            Status
          </th>
          <th
            scope="col"
            className="relative isolate whitespace-nowrap px-4 py-3.5 pr-2 text-left font-normal"
          >
            Used by
          </th>
          <th
            scope="col"
            className="relative isolate whitespace-nowrap px-4 py-3.5 pr-2 font-normal"
          >
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {accounts.map((account) => (
          <AccountListItem
            key={account.id}
            account={account}
            returnPath={returnPath}
          />
        ))}
      </tbody>
    </table>
  )
}

export default AccountsList

interface AccountListItemProps {
  account: Account
  returnPath: string
}

const AccountListItem = ({ account, returnPath }: AccountListItemProps) => {
  const childClass = twMerge(
    'dark:group-hover:bg-polar-700 px-4 py-2 transition-colors group-hover:bg-blue-50 group-hover:text-gray-950 text-gray-700 dark:text-polar-200 group-hover:dark:text-polar-50',
  )

  const isActive =
    account?.status === Status.UNREVIEWED || account?.status === Status.ACTIVE
  const isUnderReview = account?.status === Status.UNDER_REVIEW

  const goToOnboarding = async () => {
    const link = await api.accounts.onboardingLink({
      id: account.id,
      returnPath,
    })
    window.location.href = link.url
  }

  const goToDashboard = async () => {
    const link = await api.accounts.dashboardLink({
      id: account.id,
    })
    window.location.href = link.url
  }

  return (
    <tr className="group text-sm">
      <td className={twMerge(childClass, 'rounded-l-xl')}>
        {ACCOUNT_TYPE_DISPLAY_NAMES[account.account_type]}
      </td>
      <td className={childClass}>
        {ACCOUNT_STATUS_DISPLAY_NAMES[account.status]}
      </td>
      <td className={childClass}>
        <AccountAssociations account={account} />
      </td>
      <td className={twMerge(childClass, 'rounded-r-xl uppercase')}>
        {!isActive && !isUnderReview && (
          <Button size="sm" onClick={goToOnboarding}>
            Continue setup
          </Button>
        )}
        {isActive && (
          <Button size="sm" onClick={goToDashboard}>
            Open dashboard
          </Button>
        )}
      </td>
    </tr>
  )
}
