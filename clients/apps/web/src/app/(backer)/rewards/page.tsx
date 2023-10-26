'use client'

import SetupAccount from '@/components/Dashboard/SetupAccount'
import { HeaderPill, RewardsContent } from '@/components/Finance/Finance'
import Icon from '@/components/Icons/Icon'
import { Modal as ModernModal } from '@/components/Modal'
import { useRequireAuth } from '@/hooks'
import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { Account, AccountType, UserRead } from '@polar-sh/sdk'
import { ACCOUNT_TYPE_DISPLAY_NAMES, ACCOUNT_TYPE_ICON } from 'polarkit/account'
import { api } from 'polarkit/api'
import { Button } from 'polarkit/components/ui/atoms'
import { Banner } from 'polarkit/components/ui/molecules'
import { useListAccountsByUser, useListRewardsToUser } from 'polarkit/hooks'
import { useState } from 'react'

export default function Page() {
  const { currentUser } = useRequireAuth()
  const rewards = useListRewardsToUser(currentUser?.id)
  const accounts = useListAccountsByUser(currentUser?.id)

  const rewardsSum = rewards.data?.items
    ? rewards.data.items.map((r) => r.amount.amount).reduce((a, b) => a + b, 0)
    : 0

  return (
    <>
      {rewards.data?.items && currentUser && (
        <div className="flex flex-col space-y-8">
          <AccountBanner
            accounts={accounts.data?.items || []}
            user={currentUser}
          />
          <HeaderPill
            title="Your rewards"
            amount={rewardsSum}
            active={true}
            href="/rewards"
          />
          <RewardsContent rewards={rewards.data.items} showReceiver={false} />
        </div>
      )}
    </>
  )
}

const AccountBanner = (props: { user: UserRead; accounts: Account[] }) => {
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
            You need to set up <strong>Stripe</strong> to receive payouts
          </span>
        </Banner>
        <ModernModal
          isShown={showSetupModal}
          hide={toggle}
          className="min-w-[400px]"
          modalContent={
            <SetupAccount
              onClose={() => setShowSetupModal(false)}
              accountTypes={[AccountType.STRIPE]}
              forUserId={props.user.id}
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
            size="small"
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
          account to receive payouts
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
              <button
                className="whitespace-nowrap font-medium text-blue-500 dark:text-blue-400"
                onClick={(e) => {
                  e.preventDefault()
                  goToDashboard(accounts[0])
                }}
              >
                Go to {ACCOUNT_TYPE_DISPLAY_NAMES[accountType]}
              </button>
            </>
          }
        >
          <Icon classes="bg-blue-500 p-1" icon={<AccountTypeIcon />} />
          <span className="dark:text-polar-400 text-sm">
            {accountType === AccountType.STRIPE &&
              'Payouts will be sent to the connected Stripe account'}
            {accountType === AccountType.OPEN_COLLECTIVE &&
              'Payouts will be sent in bulk once per month to the connected Open Collective account'}
          </span>
        </Banner>
      </>
    )
  }

  return null
}
