import {
  ACCOUNT_TYPE_DISPLAY_NAMES,
  ORGANIZATION_STATUS_DISPLAY_NAMES,
} from '@/utils/account'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import AccountAssociations from './AccountAssociations'
import AccountCreateModal from './AccountCreateModal'

interface AccountsListProps {
  accounts: schemas['Account'][]
  organization?: schemas['Organization']
  pauseActions?: boolean
}

const AccountsList = ({
  accounts,
  organization,
  pauseActions,
}: AccountsListProps) => {
  const {
    isShown: isShownSetupModal,
    show: showSetupModal,
    hide: hideSetupModal,
  } = useModal()

  const [organizationData, setOrganizationData] = useState({ id: '', slug: '' })

  const handleShowModal = (
    organizationId: string,
    organizationSlug: string,
  ) => {
    setOrganizationData({ id: organizationId, slug: organizationSlug })
    showSetupModal()
  }

  return (
    <>
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
              organization={organization}
              pauseActions={pauseActions}
              openModal={handleShowModal}
            />
          ))}
        </tbody>
      </table>
      <Modal
        isShown={isShownSetupModal}
        className="min-w-[400px]"
        hide={hideSetupModal}
        modalContent={
          <AccountCreateModal
            forOrganizationId={organizationData.id}
            returnPath={`/dashboard/${organizationData.slug}/finance/account`}
          />
        }
      />
    </>
  )
}

export default AccountsList

interface AccountListItemProps {
  account: schemas['Account']
  organization?: schemas['Organization']
  pauseActions?: boolean
  openModal: (organizationId: string, organizationSlug: string) => void
}

const AccountListItem = ({
  account,
  organization,
  pauseActions,
  openModal,
}: AccountListItemProps) => {
  pauseActions = pauseActions === true
  const childClass = twMerge(
    'dark:group-hover:bg-polar-700 px-4 py-2 transition-colors group-hover:bg-blue-50 group-hover:text-gray-950 text-gray-700 dark:text-polar-200 group-hover:dark:text-white',
  )

  const isActive = organization?.status === 'active'
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
      <td className={childClass}>
        <AccountAssociations account={account} />
      </td>
      <td className={twMerge(childClass, 'rounded-r-xl uppercase')}>
        {!isActive && !isUnderReview && organization && (
          <Button
            size="sm"
            onClick={() => openModal(organization.id, organization.slug)}
            disabled={pauseActions}
          >
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
