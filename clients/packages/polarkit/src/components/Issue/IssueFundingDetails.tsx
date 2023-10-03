import { IssueFunding, PledgesTypeSummaries } from 'polarkit/api/client'
import { IssueActivityBox, IssueSummary } from './'
import FundingPill from './FundingPill'
import PledgeSummaryPill from './PledgeSummaryPill'
import PublicRewardPill from './PublicRewardPill'

interface IssueFundingDetailsProps {
  issueFunding: IssueFunding
  pledgesSummaries?: PledgesTypeSummaries
  showLogo?: boolean
  showStatus?: boolean
  summaryRight?: React.ReactElement
}

const IssueFundingDetails: React.FC<IssueFundingDetailsProps> = ({
  issueFunding,
  showLogo,
  showStatus,
  summaryRight,
}) => {
  const {
    issue,
    total,
    funding_goal,
    pledges_summaries: { pay_on_completion, pay_upfront },
  } = issueFunding
  const showFunding =
    total.amount > 0 || !!funding_goal || !!issue.upfront_split_to_contributors

  return (
    <>
      <IssueSummary
        issue={issue}
        showLogo={showLogo}
        showStatus={showStatus}
        right={summaryRight}
      />
      {showFunding && (
        <IssueActivityBox>
          <div className="flex flex-row items-center space-x-4 p-4">
            <FundingPill total={total} goal={funding_goal} />

            {pay_upfront.total.amount > 0 && (
              <PledgeSummaryPill.Funded summary={pay_upfront} />
            )}

            {pay_on_completion.total.amount > 0 && (
              <PledgeSummaryPill.Pledged summary={pay_on_completion} />
            )}

            {issue.upfront_split_to_contributors && (
              <PublicRewardPill percent={issue.upfront_split_to_contributors} />
            )}
          </div>
        </IssueActivityBox>
      )}
    </>
  )
}

export default IssueFundingDetails
