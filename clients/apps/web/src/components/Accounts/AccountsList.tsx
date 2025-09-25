import {
  ACCOUNT_TYPE_DISPLAY_NAMES,
  ORGANIZATION_STATUS_DISPLAY_NAMES,
} from '@/utils/account'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface AccountsListProps {
  accounts: schemas['Account'][]
  pauseActions?: boolean
}

const AccountsList = ({ accounts }: AccountsListProps) => {
  const accountOrgs = useMemo(
    () =>
      accounts.flatMap((account) =>
        account.organizations.map((organization) => ({
          account,
          organization,
        })),
      ),
    [accounts],
  )

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
        {accountOrgs.map(({ account, organization }) => (
          <AccountListItem
            key={organization.id}
            account={account}
            organization={organization}
          />
        ))}
      </tbody>
    </table>
  )
}

export default AccountsList

interface AccountListItemProps {
  account: schemas['Account']
  organization: schemas['Organization']
}

const AccountListItem = ({ account, organization }: AccountListItemProps) => {
  const childClass = twMerge(
    'dark:group-hover:bg-polar-700 px-4 py-2 transition-colors group-hover:bg-blue-50 group-hover:text-gray-950 text-gray-700 dark:text-polar-200 group-hover:dark:text-white',
  )

  const isActive =
    organization?.status === 'active' && account?.stripe_id !== null
  const isUnderReview = organization?.status === 'under_review'

  const goToDashboard = async () => {
    const link = await unwrap(
      api.POST('/v1/accounts/{id}/dashboard_link', {
        params: {
          path: {
            id: account.id,
          },
        },
      }),
    )
    window.location.href = link.url
  }

  return (
    <tr className="group text-sm">
      <td className={twMerge(childClass, 'rounded-l-xl')}>
        {ACCOUNT_TYPE_DISPLAY_NAMES[account.account_type]}
      </td>
      <td className={childClass}>
        {organization
          ? ORGANIZATION_STATUS_DISPLAY_NAMES[organization.status]
          : 'No Status'}
      </td>
      <td className={childClass}>{organization.slug}</td>
      <td className={twMerge(childClass, 'rounded-r-xl uppercase')}>
        {!isActive && !isUnderReview && (
          <Link href={`/dashboard/${organization.slug}/finance/account`}>
            <Button size="sm">Continue setup</Button>
          </Link>
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
