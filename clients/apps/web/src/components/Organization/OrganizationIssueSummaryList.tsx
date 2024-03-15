import {
  ArrowForwardOutlined,
  FavoriteBorderOutlined,
} from '@mui/icons-material'
import { IssueFunding, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  IssueActivityBox,
  IssueFundingDetails,
  IssueSummary,
} from 'polarkit/components/Issue'
import Button from 'polarkit/components/ui/atoms/button'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
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
    <div className="flex w-full flex-col gap-y-6">
      <div className="flex flex-col justify-between gap-2 md:flex-row">
        <h2 className="text-lg">Top Issues</h2>
        <Link
          className="text-sm text-blue-500 dark:text-blue-400"
          href={organizationPageLink(organization, 'issues')}
        >
          <span>View all</span>
        </Link>
      </div>
      <ShadowBoxOnMd>
        <div className="-mx-4 flex flex-col divide-y md:divide-y-0">
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
      </ShadowBoxOnMd>
    </div>
  )
}
