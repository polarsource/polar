import { CheckCircleIcon } from '@heroicons/react/24/outline'
import {
  Funding,
  Issue,
  Pledge,
  PledgesTypeSummaries,
  UserRead,
} from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import FundingPill from './FundingPill'
import PledgeSummaryPill from './PledgeSummaryPill'
import PublicRewardPill from './PublicRewardPill'

interface Props {
  pledges: Array<Pledge>
  onConfirmPledges: () => void
  showConfirmPledgeAction: boolean
  confirmPledgeIsLoading: boolean
  funding: Funding
  showSelfPledgesFor?: UserRead
  issue: Issue
  pledgesSummary: PledgesTypeSummaries
}

const IssuePledge = (props: Props) => {
  const {
    pledges,
    showConfirmPledgeAction,
    confirmPledgeIsLoading,
    showSelfPledgesFor,
    issue,
  } = props

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

  const currentUserPledges = showSelfPledgesFor
    ? pledges.filter((p) => {
        if (p.pledger?.github_username === showSelfPledgesFor.username) {
          return true
        }
      })
    : []

  const selfContribution = currentUserPledges.reduce(
    (a, b) => a + b.amount.amount,
    0,
  )

  return (
    <>
      <div className="flex flex-row items-center space-x-4 p-4">
        <div className="flex flex-1 flex-row items-center space-x-4">
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

          {props.issue.upfront_split_to_contributors && (
            <PublicRewardPill
              percent={props.issue.upfront_split_to_contributors}
            />
          )}
        </div>

        <div className="flex flex-row items-center space-x-4">
          {showConfirmPledgeAction && (
            <>
              {isConfirmed && (
                <div className="flex flex-row items-center gap-1 text-sm text-gray-700 dark:text-gray-400">
                  <CheckCircleIcon className="h-5 w-5 text-green-700 dark:text-green-500" />
                  <span>Completed</span>
                </div>
              )}
              {confirmPledgeIsLoading && (
                <span className="text-sm font-medium text-gray-600 dark:text-gray-500">
                  Loading...
                </span>
              )}
              {confirmable && (
                <button
                  className="flex items-center gap-2 rounded-md border border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition duration-100 hover:bg-gray-300/50 hover:text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-900"
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

      {showSelfPledgesFor && selfContribution > 0 && (
        <div
          className={twMerge(
            'border-t dark:border-gray-700',
            'flex flex-row items-center gap-4 bg-gray-50 bg-white px-4 py-2 dark:bg-transparent  ',
          )}
        >
          <img
            src={showSelfPledgesFor?.avatar_url}
            className="h-6 w-6 rounded-full"
          />
          <div className="text-sm ">
            You&apos;ve contributed $
            {getCentsInDollarString(selfContribution, false, true)} to this
            issue
          </div>
        </div>
      )}
    </>
  )
}

export default IssuePledge
