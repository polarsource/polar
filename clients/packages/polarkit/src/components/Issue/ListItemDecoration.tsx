import {
  IssueReferenceRead,
  PledgeRead,
  PledgeState,
} from 'polarkit/api/client'
import { classNames, getCentsInDollarString } from 'polarkit/utils'
import IssuePledge from './IssuePledge'
import IssueReference from './Reference'

const IssueListItemDecoration = ({
  orgName,
  repoName,
  pledges,
  references,
  showDisputeAction,
  onDispute,
}: {
  orgName: string
  repoName: string
  pledges: PledgeRead[]
  references: IssueReferenceRead[]
  showDisputeAction?: boolean
  onDispute?: (pledge: PledgeRead) => void
}) => {
  const showPledges = pledges && pledges.length > 0

  const ONE_DAY = 1000 * 60 * 60 * 24
  const canDisputeAny =
    pledges &&
    pledges.find(
      (p) =>
        p.authed_user_can_admin &&
        p.scheduled_payout_at &&
        p.state === PledgeState.PENDING,
    )
  const now = new Date()
  const disputeDays =
    canDisputeAny && canDisputeAny.scheduled_payout_at
      ? Math.floor(
          (new Date(canDisputeAny.scheduled_payout_at).getTime() -
            now.getTime()) /
            ONE_DAY,
        )
      : 0

  const disputedPledges = pledges.filter(
    (p) => p.state === PledgeState.DISPUTED,
  )

  const showDisputeBox = disputedPledges.length > 0 || canDisputeAny

  const onClickDisputeButton = () => {
    if (!canDisputeAny || !onDispute) {
      return
    }
    // TODO: Support disputing multiple pledges to the same issue?
    onDispute(canDisputeAny)
  }

  return (
    <div>
      <div className="flex flex-row items-center px-4 py-3">
        {showPledges && (
          <div className="stretch mr-4 flex-none">
            <IssuePledge pledges={pledges} />
          </div>
        )}

        <div className={classNames(pledges ? 'border-l pl-4' : '', 'flex-1')}>
          {references &&
            references.map((r: IssueReferenceRead) => {
              return (
                <IssueReference
                  orgName={orgName}
                  repoName={repoName}
                  reference={r}
                  key={r.id}
                />
              )
            })}

          {!references && (
            <p className="text-sm italic text-gray-400">Not picked up yet</p>
          )}
        </div>
      </div>
      {showDisputeAction && showDisputeBox && (
        <div className="border-t-2 border-gray-100 bg-gray-50 px-4 py-1">
          {canDisputeAny && (
            <div>
              <span className="text-sm text-gray-500">
                <a
                  href="#"
                  onClick={onClickDisputeButton}
                  className="text-blue-600"
                >
                  Dispute
                </a>{' '}
                within {disputeDays} {disputeDays === 1 ? 'day' : 'days'}
              </span>
            </div>
          )}

          {disputedPledges.map((p) => {
            return (
              <div>
                {p.authed_user_can_admin && (
                  <span className="text-sm text-gray-500">
                    You've disputed your pledge ($
                    {getCentsInDollarString(p.amount)})
                  </span>
                )}

                {!p.authed_user_can_admin && (
                  <span className="text-sm text-gray-500">
                    {p.pledger_name} disputed their pledge ($
                    {getCentsInDollarString(p.amount)})
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
