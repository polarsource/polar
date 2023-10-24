import { CurrencyAmount, Issue, PledgesTypeSummaries } from '@polar-sh/sdk'
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

  const upfrontSplit =
    issue.upfront_split_to_contributors ??
    issue.repository.organization.default_upfront_split_to_contributors

  return (
    <div className="flex flex-wrap items-center gap-4">
      <FundingPill total={total} goal={fundingGoal} />

      {pay_upfront.total.amount > 0 && (
        <PledgeSummaryPill.Funded summary={pay_upfront} />
      )}

      {pay_on_completion.total.amount > 0 && (
        <PledgeSummaryPill.Pledged summary={pay_on_completion} />
      )}

      {upfrontSplit ? <PublicRewardPill percent={upfrontSplit} /> : null}
    </div>
  )
}

export default IssueFundingDetails
