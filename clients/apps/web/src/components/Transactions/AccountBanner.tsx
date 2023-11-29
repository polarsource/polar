import { ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { Account, AccountType, Organization } from '@polar-sh/sdk'
import { api } from 'polarkit'
import {
  ACCOUNT_TYPE_DISPLAY_NAMES,
  ACCOUNT_TYPE_ICON,
  ALL_ACCOUNT_TYPES,
} from 'polarkit/account'
import { Button } from 'polarkit/components/ui/atoms'
import { Banner } from 'polarkit/components/ui/molecules'
import { useState } from 'react'
import SetupAccount from '../Dashboard/SetupAccount'
import Icon from '../Icons/Icon'
import { Modal } from '../Modal'

const AccountBanner = (props: { org: Organization; accounts: Account[] }) => {
  const { accounts } = props

  const goToDashboard = async (account: Account) => {
    const link = await api.accounts.dashboardLink({
      id: account.id,
    })
    window.location.href = link.url
  }

  const goToOnboarding = async (account: Account) => {
    const link = await api.accounts.onboardingLink({
      id: account.id,
    })
    window.location.href = link.url
  }

  const [showSetupModal, setShowSetupModal] = useState(false)

  const toggle = () => {
    setShowSetupModal(!showSetupModal)
  }

  if (accounts.length === 0) {
    return (
      <>
        <Banner
          color="default"
          right={
            <Button
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                setShowSetupModal(true)
              }}
            >
              <span>Setup</span>
            </Button>
          }
        >
          <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
          <span className="text-sm">
            You need to set up <strong>Stripe</strong> or{' '}
            <strong>Open Collective</strong> to receive transfers
          </span>
        </Banner>
        <Modal
          isShown={showSetupModal}
          className="min-w-[400px]"
          hide={toggle}
          modalContent={
            <SetupAccount
              onClose={() => setShowSetupModal(false)}
              accountTypes={ALL_ACCOUNT_TYPES}
              forOrganizationId={props.org.id}
            />
          }
        />
      </>
    )
  }

  if (accounts.length > 0 && !accounts[0].is_details_submitted) {
    const AccountTypeIcon = ACCOUNT_TYPE_ICON[accounts[0].account_type]
    return (
      <Banner
        color="default"
        right={
          <Button
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              goToOnboarding(accounts[0])
            }}
          >
            <span>Continue setup</span>
          </Button>
        }
      >
        <Icon classes="bg-blue-500 p-1" icon={<AccountTypeIcon />} />
        <span className="text-sm">
          Continue the setup of your{' '}
          <strong>
            {ACCOUNT_TYPE_DISPLAY_NAMES[accounts[0].account_type]}
          </strong>{' '}
          account to receive transfers
        </span>
      </Banner>
    )
  }

  if (accounts.length > 0 && accounts[0].is_details_submitted) {
    const accountType = accounts[0].account_type
    const AccountTypeIcon = ACCOUNT_TYPE_ICON[accountType]
    return (
      <>
        <Banner
          color="muted"
          right={
            <>
              {true && (
                <button
                  className="whitespace-nowrap font-medium text-blue-500 dark:text-blue-400"
                  onClick={(e) => {
                    e.preventDefault()
                    goToDashboard(accounts[0])
                  }}
                >
                  Go to {ACCOUNT_TYPE_DISPLAY_NAMES[accountType]}
                </button>
              )}
              {false && (
                <span className="text-gray-400">
                  Ask the admin to make changes
                </span>
              )}
            </>
          }
        >
          <Icon classes="bg-blue-500 p-1" icon={<AccountTypeIcon />} />
          <span className="dark:text-polar-400 text-sm">
            {accountType === AccountType.STRIPE &&
              'Transfers will be sent to the connected Stripe account'}
            {accountType === AccountType.OPEN_COLLECTIVE &&
              'Transfers will be sent in bulk once per month to the connected Open Collective account'}
          </span>
        </Banner>
      </>
    )
  }

  return null
}

export default AccountBanner
