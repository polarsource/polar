import {
  CheckCircleIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline'
import {
  Funding,
  Issue,
  Pledge,
  PledgeState,
  PledgeType,
  PledgesTypeSummaries,
} from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { FormattedDateTime } from '../ui/atoms'
import Avatar from '../ui/atoms/Avatar'
import FundingPill from './FundingPill'
import PledgeSummaryPill from './PledgeSummaryPill'
import PublicRewardPill from './PublicRewardPill'

interface Props {
  pledges: Array<Pledge>
  onConfirmPledges: () => void
  showConfirmPledgeAction: boolean
  confirmPledgeIsLoading: boolean
  funding: Funding

  issue: Issue
  pledgesSummary: PledgesTypeSummaries
}

const IssuePledge = (props: Props) => {
  const { pledges, showConfirmPledgeAction, confirmPledgeIsLoading, issue } =
    props

  const totalPledgeAmount = Math.max(
    issue.funding.pledges_sum?.amount ?? 0,
    pledges.reduce((a, b) => a + b.amount.amount, 0),
  )

  const confirmable = useMemo(() => {
    return (
      pledges.some(
        (p) => issue.needs_confirmation_solved && p.authed_can_admin_received,
      ) && !confirmPledgeIsLoading
    )
  }, [pledges, confirmPledgeIsLoading, issue])

  const isConfirmed = useMemo(() => {
    return !confirmable && issue.confirmed_solved_at && !confirmPledgeIsLoading
  }, [confirmPledgeIsLoading, confirmable, issue])

  const showFundingGoal =
    props.funding?.funding_goal?.amount && props.funding.funding_goal.amount > 0

  const selfMadePledges = pledges.filter((p) => p.authed_can_admin_sender)

  const upfrontSplit =
    issue.upfront_split_to_contributors ??
    issue.repository.organization.default_upfront_split_to_contributors

  return (
    <>
      <div className="flex flex-col space-x-0 space-y-6 px-6 py-4 md:flex-row md:items-center md:justify-between md:space-x-4 md:space-y-0">
        <div className="flex flex-wrap items-center gap-4">
          <FundingPill
            total={{ amount: totalPledgeAmount, currency: 'USD' }}
            goal={showFundingGoal ? issue.funding.funding_goal : undefined}
          />

          {props.pledgesSummary.pay_upfront.total.amount > 0 && (
            <PledgeSummaryPill.Funded
              summary={props.pledgesSummary.pay_upfront}
            />
          )}

          {props.pledgesSummary.pay_on_completion.total.amount > 0 && (
            <PledgeSummaryPill.Pledged
              summary={props.pledgesSummary.pay_on_completion}
            />
          )}

          {upfrontSplit ? <PublicRewardPill percent={upfrontSplit} /> : null}
        </div>

        <div className="flex flex-row items-center space-x-4">
          {showConfirmPledgeAction && (
            <>
              {isConfirmed && (
                <div className="dark:text-polar-400 flex flex-row items-center gap-1 text-sm text-gray-700">
                  <CheckCircleIcon className="h-5 w-5 text-green-700 dark:text-green-500" />
                  <span>Completed</span>
                </div>
              )}
              {confirmPledgeIsLoading && (
                <span className="dark:text-polar-500 text-sm font-medium text-gray-600">
                  Loading...
                </span>
              )}
              {confirmable && (
                <button
                  className="dark:bg-polar-700 dark:border-polar-600 dark:text-polar-400 dark:hover:bg-polar-900 flex items-center gap-2 rounded-md border border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition duration-100 hover:bg-gray-300/50 hover:text-gray-800"
                  onClick={props.onConfirmPledges}
                >
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                  Mark as completed
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {selfMadePledges.map((p) => (
        <div
          className={twMerge(
            'dark:border-polar-700 border-t',
            'flex flex-row items-center gap-2 bg-gray-50 bg-white px-6 py-2 text-sm  dark:bg-transparent',
          )}
          key={p.id}
        >
          <Avatar
            name={p.pledger?.name || ''}
            avatar_url={p.pledger?.avatar_url}
          />
          <div className="flex-1">
            {p.pledger?.name} {pledgeVerb(p)} $
            {getCentsInDollarString(p.amount.amount, false, true)} to this issue
            on <FormattedDateTime datetime={p.created_at} dateStyle="long" />
          </div>

          <div className="flex items-center gap-4">
            {p.created_by ? (
              <div className="flex items-center gap-1">
                <Avatar
                  name={p.created_by?.name || ''}
                  avatar_url={p.created_by?.avatar_url}
                />
                <span>{p.created_by.name}</span>
              </div>
            ) : null}

            {p.hosted_invoice_url ? (
              <a
                href={p.hosted_invoice_url}
                className="border-1 dark:text-polar-200 dark:border-polar-400 dark:hover:bg-polar-700 flex items-center gap-2 rounded-md border border-gray-300 py-1 pl-3 pr-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {p.state === PledgeState.CREATED ? (
                  <span>Pay Invoice</span>
                ) : null}
                {p.state === PledgeState.PENDING ? (
                  <span className="text-xs">Invoice Paid</span>
                ) : null}
                {p.state === PledgeState.CREATED ? (
                  <ChevronDoubleRightIcon className="h-4 w-4" />
                ) : null}
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </>
  )
}

const pledgeVerb = (p: Pledge) => {
  switch (p.type) {
    case PledgeType.UPFRONT:
      return 'contributed'
    case PledgeType.ON_COMPLETION:
      return 'pledged'
    case PledgeType.DIRECTLY:
      return 'gifted'
    default:
      // TS compile time check that all cases are covered
      const exhaustiveCheck: never = p.type
      throw new Error(`Unhandled case: ${exhaustiveCheck}`)
  }
}

export default IssuePledge
