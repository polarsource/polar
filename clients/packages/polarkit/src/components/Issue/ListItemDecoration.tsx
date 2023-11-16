import {
  Funding,
  Issue,
  IssueReferenceRead,
  Pledge,
  PledgeState,
  PledgesTypeSummaries,
  Reward,
} from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'
import { twMerge } from 'tailwind-merge'
import IssuePledge from './IssuePledge'
import IssueReference from './IssueReference'
import IssueRewards from './IssueRewards'

// When rendering in the Chrome Extension, the iframe needs to know it's expected height in pixels
export const getExpectedHeight = ({
  pledges,
  references,
}: {
  pledges: Pledge[]
  references: IssueReferenceRead[]
}): number => {
  const pledgeHeight = pledges.length > 0 ? 28 : 0
  const referenceHeight = 28 * references.length
  const inner = Math.max(pledgeHeight, referenceHeight)
  return inner + 24
}

const IssueListItemDecoration = ({
  pledges,
  pledgesSummary,
  references,
  showDisputeAction,
  onDispute,
  onConfirmPledges,
  showConfirmPledgeAction,
  confirmPledgeIsLoading,
  funding,
  issue,
  rewards,
}: {
  pledges: Array<Pledge>
  pledgesSummary?: PledgesTypeSummaries
  references: IssueReferenceRead[]
  showDisputeAction: boolean
  onDispute: (pledge: Pledge) => void
  onConfirmPledges: () => void
  showConfirmPledgeAction: boolean
  confirmPledgeIsLoading: boolean
  funding: Funding
  issue: Issue
  rewards?: Reward[]
}) => {
  const showPledges = pledges && pledges.length > 0

  const ONE_DAY = 1000 * 60 * 60 * 24
  const now = new Date()

  const remainingDays = (pledge: Pledge) => {
    if (!pledge.scheduled_payout_at) {
      return -1
    }

    return Math.floor(
      (new Date(pledge.scheduled_payout_at).getTime() - now.getTime()) /
        ONE_DAY,
    )
  }

  const disputablePledges =
    pledges
      ?.filter(
        (p) =>
          p.authed_can_admin_sender &&
          p.scheduled_payout_at &&
          p.state === PledgeState.PENDING &&
          remainingDays(p) >= 0,
      )
      .map((p) => {
        return {
          ...p,
          remaining_days: remainingDays(p),
        }
      }) || []

  const disputedPledges =
    pledges?.filter((p) => p.state === PledgeState.DISPUTED) || []

  const canDisputeAny =
    pledges &&
    pledges.find(
      (p) =>
        p.authed_can_admin_sender &&
        p.scheduled_payout_at &&
        p.state === PledgeState.PENDING &&
        remainingDays(p) >= 0,
    )

  const pledgeStatusShowCount =
    disputablePledges.length + disputedPledges.length

  const showPledgeStatusBox = pledgeStatusShowCount > 0
  const disputeBoxShowAmount = pledgeStatusShowCount > 1

  const onClickDisputeButton = (pledge: Pledge) => {
    if (!canDisputeAny || !onDispute) {
      return
    }
    onDispute(pledge)
  }

  const pledgeAmount = (pledge: Pledge): number => {
    if (typeof pledge.amount === 'number') {
      return pledge.amount
    }
    return pledge.amount.amount
  }

  const haveReferences = references && references.length > 0

  const pledgesSummaryOrDefault = pledgesSummary ?? {
    pay_directly: { total: { currency: 'USD', amount: 0 }, pledgers: [] },
    pay_on_completion: { total: { currency: 'USD', amount: 0 }, pledgers: [] },
    pay_upfront: { total: { currency: 'USD', amount: 0 }, pledgers: [] },
  }

  return (
    <div>
      <div className="dark:divide-polar-700 flex flex-col divide-y divide-gray-100">
        {showPledges && (
          <IssuePledge
            issue={issue}
            pledges={pledges}
            pledgesSummary={pledgesSummaryOrDefault}
            onConfirmPledges={onConfirmPledges}
            showConfirmPledgeAction={showConfirmPledgeAction}
            confirmPledgeIsLoading={confirmPledgeIsLoading}
            funding={funding}
          />
        )}
        {haveReferences && (
          <div
            className={twMerge(
              'dark:bg-polar-900 space-y-2 bg-gray-50 px-6 py-2',
            )}
          >
            {haveReferences &&
              references.map((r: IssueReferenceRead) => {
                return (
                  <IssueReference
                    orgName={issue.repository.organization.name}
                    repoName={issue.repository.name}
                    reference={r}
                    key={r.id}
                  />
                )
              })}
          </div>
        )}
        {rewards && rewards?.length > 0 && <IssueRewards rewards={rewards} />}
      </div>

      {showDisputeAction && showPledgeStatusBox && (
        <div className="dark:bg-polar-900 dark:border-polar-700 border-t border-gray-100 bg-gray-50 px-6 pb-1.5 pt-1">
          {disputablePledges.map((p) => {
            return (
              <div key={p.id}>
                <span className="text-sm text-gray-500">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      onClickDisputeButton(p)
                    }}
                    className="text-blue-500 dark:text-blue-500"
                  >
                    Dispute
                  </a>{' '}
                  {p.remaining_days > 0 && (
                    <>
                      within {p.remaining_days}{' '}
                      {p.remaining_days === 1 ? 'day' : 'days'}
                    </>
                  )}
                  {p.remaining_days == 0 && <>today</>}{' '}
                  {disputeBoxShowAmount && (
                    <>(${getCentsInDollarString(pledgeAmount(p))})</>
                  )}
                </span>
              </div>
            )
          })}

          {disputedPledges.map((p) => {
            return (
              <div key={p.id}>
                {p.authed_can_admin_sender && (
                  <span className="text-sm text-gray-500">
                    You&apos;ve disputed your pledge{' '}
                    {disputeBoxShowAmount && (
                      <>(${getCentsInDollarString(p.amount.amount)})</>
                    )}
                  </span>
                )}

                {p.authed_can_admin_received && (
                  <span className="text-sm text-gray-500">
                    {p.pledger?.name} disputed their pledge{' '}
                    {disputeBoxShowAmount && (
                      <>(${getCentsInDollarString(p.amount.amount)})</>
                    )}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default IssueListItemDecoration
