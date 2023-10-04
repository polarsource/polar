import {
  CurrencyAmount,
  Issue,
  PledgesTypeSummaries,
} from 'polarkit/api/client'
import FundingPill from './FundingPill'
import PledgeSummaryPill from './PledgeSummaryPill'
import PublicRewardPill from './PublicRewardPill'

interface IssueFundingDetailsProps {
  issue: Issue
  total: CurrencyAmount
  fundingGoal?: CurrencyAmount
  pledgesSummaries: PledgesTypeSummaries
  showLogo?: boolean
  showStatus?: boolean
  summaryRight?: React.ReactElement
}

const IssueFundingDetails: React.FC<IssueFundingDetailsProps> = ({
  issue,
  total,
  fundingGoal,
  pledgesSummaries,
}) => {
  const { pay_upfront, pay_on_completion } = pledgesSummaries
  return (
    <div className="flex flex-row items-center space-x-4">
      <FundingPill total={total} goal={fundingGoal} />

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
  )
}

export default IssueFundingDetails
