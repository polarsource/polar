import { FavoriteBorderOutlined } from '@mui/icons-material'
import { IssueFunding, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  IssueActivityBox,
  IssueFundingDetails,
  IssueSummary,
} from 'polarkit/components/Issue'
import { Button, Card } from 'polarkit/components/ui/atoms'
import { organizationPageLink } from 'polarkit/utils/nav'
import { Fragment } from 'react'

export interface OrganizationIssueSummaryListProps {
  organization: Organization
  issues: IssueFunding[]
}

export const OrganizationIssueSummaryList = ({
  organization,
  issues,
}: OrganizationIssueSummaryListProps) => {
  if (!issues) {
    return <></>
  }

  return (
    <Card className="flex flex-col gap-y-8 p-10">
      <div className="flex flex-row justify-between">
        <div className="flex flex-col gap-y-1">
          <h2 className="text-lg">Top Issues</h2>
          <p className="dark:text-polar-500 text-gray-500">
            {organization.name} is looking for funding
          </p>
        </div>
        <Link
          href={organizationPageLink(organization, 'issues')}
          className="font-medium text-blue-500"
        >
          <Button size="sm">
            <span>View all issues</span>
          </Button>
        </Link>
      </div>
      <div className="-mx-6 flex flex-col divide-y md:divide-y-0">
        {issues.map((i) => (
          <Fragment key={i.issue.id}>
            <IssueSummary
              issue={i.issue}
              right={
                <Link
                  href={organizationPageLink(
                    organization,
                    `${i.issue.repository.name}/issues/${i.issue.number}`,
                  )}
                  className="font-medium text-blue-500"
                >
                  <Button size="sm" variant="secondary" asChild>
                    <FavoriteBorderOutlined fontSize="inherit" />
                    <span className="ml-1.5">Fund</span>
                  </Button>
                </Link>
              }
            />
            {(i.total.amount > 0 ||
              !!i.funding_goal ||
              !!i.issue.upfront_split_to_contributors) && (
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
          </Fragment>
        ))}
      </div>
    </Card>
  )
}
