import Link from 'next/link'
import {
  OrganizationPrivateRead,
  PledgeResources,
  PledgeState,
} from 'polarkit/api/client'
import { getCentsInDollarString } from 'polarkit/money'
import { classNames } from 'polarkit/utils'
import List from './List'

const Transactions = (props: {
  org: OrganizationPrivateRead
  tab: 'current' | 'rewarded'
  pledges: PledgeResources[]
}) => {
  const { org, tab, pledges } = props

  const currentPledges =
    pledges.filter((pr) => pr.pledge.state !== PledgeState.PAID) || []

  const currentPledgesAmount = currentPledges
    .map((pr) => pr.pledge.amount)
    .reduce((a, b) => a + b, 0)

  const rewardedPledges =
    pledges.filter((pr) => pr.pledge.state === PledgeState.PAID) || []

  const rewardedPledgesAmount = rewardedPledges
    .map((pr) => pr.pledge.amount)
    .reduce((a, b) => a + b, 0)

  const refundedStates = [PledgeState.REFUNDED, PledgeState.CHARGE_DISPUTED]
  const inReviewStates = [
    PledgeState.CONFIRMATION_PENDING,
    PledgeState.DISPUTED,
    PledgeState.PENDING,
  ]
  const paidStates = [PledgeState.PAID]

  const tabPledges = tab === 'current' ? currentPledges : rewardedPledges

  const openIssues = tabPledges.filter(
    (pr) =>
      !paidStates.includes(pr.pledge.state) &&
      !refundedStates.includes(pr.pledge.state) &&
      !inReviewStates.includes(pr.pledge.state),
  )

  const refunded = tabPledges.filter((pr) =>
    refundedStates.includes(pr.pledge.state),
  )

  const inReview = tabPledges.filter((pr) =>
    inReviewStates.includes(pr.pledge.state),
  )

  const paid = tabPledges.filter((pr) => paidStates.includes(pr.pledge.state))

  return (
    <div className="flex flex-col space-y-8">
      <div className="flex justify-between space-x-8 px-2">
        <HeaderPill
          title="Current peldges"
          amount={currentPledgesAmount}
          active={props.tab === 'current'}
          href={`/dashboard/${org.name}/pledges`}
        />
        <HeaderPill
          title={`Rewarded to ${org.name}`}
          amount={rewardedPledgesAmount}
          active={props.tab === 'rewarded'}
          href={`/dashboard/${org.name}/pledges/rewarded`}
        />
        <HeaderPill
          title="Rewarded to contributors"
          amount={0}
          active={false}
          href={`/dashboard/${org.name}/pledges`}
        />
      </div>
      {paid.length > 0 && (
        <List
          pledges={paid}
          columns={['PAID_OUT_DATE']}
          title="Paid out"
          subtitle="Issue solved"
        />
      )}
      {inReview.length > 0 && (
        <List
          pledges={inReview}
          columns={['ESTIMATED_PAYOUT_DATE']}
          title="In review"
          subtitle="Issue solved"
        />
      )}
      {openIssues.length > 0 && (
        <List
          pledges={openIssues}
          columns={[]}
          title="Pledges on open issues"
          subtitle="Issue"
        />
      )}
      {refunded.length > 0 && (
        <List
          pledges={refunded}
          columns={['REFUNDED_DATE']}
          title="Refunds"
          subtitle="Issue"
        />
      )}
    </div>
  )
}

const HeaderPill = (props: {
  title: string
  amount: number
  active: boolean
  href: string
}) => {
  return (
    <Link
      href={props.href}
      className={classNames(
        props.active ? 'bg-white shadow' : 'border bg-gray-200',
        'flex flex-1 flex-col rounded-md py-4 px-6',
      )}
    >
      <div className="flex-1 text-lg font-medium text-gray-500">
        {props.title}
      </div>
      <div className="text-2xl font-medium text-gray-900">
        ${getCentsInDollarString(props.amount, true)}
      </div>
    </Link>
  )
}

export default Transactions
