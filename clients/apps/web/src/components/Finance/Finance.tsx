import Icon from '@/components/Icons/Icon'
import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import {
  Account,
  AccountType,
  Organization,
  Pledge,
  PledgeState,
  Reward,
  RewardState,
} from '@polar-sh/sdk'
import Link from 'next/link'
import {
  ACCOUNT_TYPE_DISPLAY_NAMES,
  ACCOUNT_TYPE_ICON,
  ALL_ACCOUNT_TYPES,
} from 'polarkit/account'
import { api } from 'polarkit/api'
import { Button } from 'polarkit/components/ui/atoms'
import { Banner } from 'polarkit/components/ui/molecules'
import { getCentsInDollarString } from 'polarkit/money'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import SetupAccount from '../Dashboard/SetupAccount'
import { Modal as ModernModal } from '../Modal'
import { default as ListPledges } from './ListPledges'
import ListRewards, { Column } from './ListRewards'

const refundedStates: PledgeState[] = [
  PledgeState.REFUNDED,
  PledgeState.CHARGE_DISPUTED,
]

const paidStates: PledgeState[] = [PledgeState.PENDING]

const isInReview = (pledge: Pledge): boolean => {
  const inReviewStates: PledgeState[] = [PledgeState.DISPUTED]
  if (inReviewStates.includes(pledge.state)) {
    return true
  }
  if (pledge.issue.needs_confirmation_solved) {
    return true
  }
  return false
}

const Finance = (props: {
  org: Organization
  tab: 'current' | 'rewarded' | 'contributors'
  pledges: Pledge[]
  accounts: Account[]
  rewards: Reward[]
}) => {
  const { org, tab, pledges, accounts, rewards } = props

  const currentPledges =
    pledges.filter(
      (pr) => pr.state !== PledgeState.PENDING && !pr.issue.confirmed_solved_at,
    ) || []

  const currentPledgesAmount = currentPledges
    .filter((pr) => !refundedStates.includes(pr.state))
    .map((pr) => pr.amount.amount)
    .reduce((a, b) => a + b, 0)

  const rewardsToSelfOrg = rewards.filter(
    (r) => r.organization && r.organization.id === org.id,
  )

  const rewardsToContributors = rewards.filter((r) => r.user)

  const rewardedToSelfAmount = rewardsToSelfOrg
    .map((r) => r.amount.amount)
    .reduce((a, b) => a + b, 0)

  const rewardedToContributorsAmount = rewardsToContributors
    .map((r) => r.amount.amount)
    .reduce((a, b) => a + b, 0)

  const tabContents: Record<string, React.ReactElement> = {
    current: <PledgesContent pledges={currentPledges} />,
    rewarded: (
      <RewardsContent rewards={rewardsToSelfOrg} showReceiver={false} />
    ),
    contributors: (
      <RewardsContent rewards={rewardsToContributors} showReceiver={true} />
    ),
  }

  return (
    <div className="flex flex-col space-y-8">
      <AccountBanner accounts={accounts} org={org} />

      <div className="flex space-x-8">
        <HeaderPill
          title="Current pledges"
          amount={currentPledgesAmount}
          active={props.tab === 'current'}
          href={`/maintainer/${org.name}/finance`}
        />
        <HeaderPill
          title={`Rewarded to ${org.name}`}
          amount={rewardedToSelfAmount}
          active={props.tab === 'rewarded'}
          href={`/maintainer/${org.name}/finance/rewarded`}
        />
        <HeaderPill
          title="Rewarded to contributors"
          amount={rewardedToContributorsAmount}
          active={props.tab === 'contributors'}
          href={`/maintainer/${org.name}/finance/contributors`}
        />
      </div>

      {tabContents[tab] || null}
    </div>
  )
}

export default Finance

const PledgesContent = (props: { pledges: Pledge[] }) => {
  const openIssues = props.pledges.filter(
    (p) =>
      !paidStates.includes(p.state) &&
      !refundedStates.includes(p.state) &&
      !isInReview(p),
  )

  const refunded = props.pledges.filter((p) => refundedStates.includes(p.state))
  const inReview = props.pledges.filter(isInReview)

  return (
    <>
      {inReview.length > 0 && (
        <ListPledges
          pledges={inReview}
          columns={['ESTIMATED_PAYOUT_DATE']}
          title="In review"
          subtitle="Issue solved"
        />
      )}
      {openIssues.length > 0 && (
        <ListPledges
          pledges={openIssues}
          columns={[]}
          title="Pledges on open issues"
          subtitle="Issue"
        />
      )}
      {refunded.length > 0 && (
        <ListPledges
          pledges={refunded}
          columns={['REFUNDED_DATE']}
          title="Refunds"
          subtitle="Issue"
        />
      )}
    </>
  )
}

export const RewardsContent = (props: {
  rewards: Reward[]
  showReceiver: boolean
}) => {
  const pending = props.rewards.filter((r) => r.state == RewardState.PENDING)
  const paid = props.rewards.filter((r) => r.state == RewardState.PAID)

  const pendingColumns: Column[] = props.showReceiver
    ? ['BACKER', 'PAYMENT_STATUS', 'RECEIVER']
    : ['BACKER', 'PAYMENT_STATUS']
  const paidColumns: Column[] = props.showReceiver
    ? ['PAID_OUT_DATE', 'BACKER', 'PAYMENT_STATUS', 'RECEIVER']
    : ['PAID_OUT_DATE', 'BACKER', 'PAYMENT_STATUS']

  return (
    <>
      {pending.length > 0 && (
        <ListRewards
          rewards={pending}
          columns={pendingColumns}
          title="Pending"
          subtitle="Issue solved"
        />
      )}
      {paid.length > 0 && (
        <ListRewards
          rewards={paid}
          columns={paidColumns}
          title="Paid"
          subtitle="Issue solved"
        />
      )}
    </>
  )
}

export const HeaderPill = (props: {
  title: string
  amount: number
  active: boolean
  href: string
}) => {
  return (
    <Link
      href={props.href}
      className={twMerge(
        props.active
          ? ' dark:bg-polar-800 dark:ring-polar-700 bg-white shadow dark:ring-1'
          : ' dark:bg-polar-900 dark:hover:bg-polar-800/50 dark:ring-polar-700 border bg-transparent hover:bg-gray-100/50 dark:ring-1',
        'transition-background relative flex w-full max-w-[300px] flex-col rounded-xl px-5 py-4 duration-200',
      )}
    >
      <div className="text-md dark:text-polar-400 flex-1 text-gray-500">
        {props.title}
      </div>
      <div className="dark:text-polar-200 text-3xl font-medium text-gray-900">
        ${getCentsInDollarString(props.amount, true, true)}
      </div>
      {props.active && props.amount > 0 && (
        <>
          <Triangle />
          <div className="dark:bg-polar-800 absolute bottom-0 left-1/2 -ml-6 h-2  w-12 bg-white"></div>
        </>
      )}
    </Link>
  )
}

const Triangle = () => (
  <svg
    width="27"
    height="15"
    viewBox="0 0 27 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="dark:text-polar-800 absolute -bottom-[12px] left-1/2 -ml-[14px] text-white drop-shadow filter dark:drop-shadow-[0_1px_0px_#3E3F42]"
  >
    <path
      d="M13.6641 15L0.673682 5.39648e-07L26.6544 -1.73166e-06L13.6641 15Z"
      fill="currentColor"
    />
  </svg>
)

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
            <strong>Open Collective</strong> to receive payouts
          </span>
        </Banner>
        <ModernModal
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
