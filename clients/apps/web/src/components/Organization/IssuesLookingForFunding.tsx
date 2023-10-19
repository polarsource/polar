import { IssueFunding } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  IssueActivityBox,
  IssueFundingDetails,
  IssueSummary,
} from 'polarkit/components/Issue'

const IssuesLookingForFunding = ({
  issuesFunding,
}: {
  issuesFunding: IssueFunding[]
}) => {
  if (issuesFunding.length < 1) {
    return <></>
  }

  return (
    <>
      <div>
        {issuesFunding.map((i) => (
          <div key={i.issue.id}>
            <IssueSummary
              issue={i.issue}
              right={
                <Link
                  href={`/${i.issue.repository.organization.name}/${i.issue.repository.name}/issues/${i.issue.number}`}
                  className="font-medium text-blue-600"
                >
                  Fund
                </Link>
              }
            />
            {(i.total.amount > 0 ||
              i.funding_goal ||
              i.issue.upfront_split_to_contributors) && (
              <IssueActivityBox>
                <div className="p-4">
                  <IssueFundingDetails
                    issue={i.issue}
                    total={i.total}
                    fundingGoal={i.funding_goal}
                    pledgesSummaries={i.pledges_summaries}
                  />
                </div>
              </IssueActivityBox>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

export default IssuesLookingForFunding
