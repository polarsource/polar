import { Issue, Organization, Repository } from 'polarkit/api/client'
import { PolarTimeAgo } from 'polarkit/components/ui'
import IconCounter from '../Dashboard/IconCounter'
import IssueListItem from '../Dashboard/IssueListItem'

const IssuesLookingForFunding = ({
  organization,
  repositories,
  issues,
}: {
  organization: Organization
  repositories: Repository[]
  issues: Issue[]
}) => {
  const showIssues = []

  if (issues) {
    for (const i of issues) {
      const repo = repositories?.find(
        (r: Repository) => r.id === i.repository.id,
      )
      if (!repo) {
        continue
      }

      showIssues.push({
        issue: i,
        repo,
        pledge_href: `/${organization.name}/${repo.name}/issues/${i.number}`,
        issue_href: `https://github.com/${organization.name}/${repo.name}/issues/${i.number}`,
      })
    }
  }

  const top3 = showIssues.slice(0, 3)
  const rest = showIssues.slice(3)

  if (showIssues.length < 1) {
    return <></>
  }

  return (
    <>
      <div className="flex flex-col justify-between space-y-4 md:flex-row md:space-x-6 md:space-y-0">
        {top3.map((i) => (
          <div
            className="flex flex-1 flex-col rounded-lg px-6 py-4 text-gray-500 shadow dark:bg-gray-900 dark:ring-1 dark:ring-gray-800"
            key={i.issue.id}
          >
            <a
              className="font-medium text-gray-900 dark:text-gray-200"
              href={i.issue_href}
            >
              {i.issue.title}
            </a>
            <p className="mt-2 flex-1 text-sm">
              #{i.issue.number} opened{' '}
              <PolarTimeAgo date={new Date(i.issue.issue_created_at)} />
            </p>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-6">
                {(i.issue.comments && i.issue.comments > 0 && (
                  <IconCounter icon="comments" count={i.issue.comments} />
                )) ||
                  null}

                {(i.issue.reactions &&
                  i.issue.reactions.plus_one &&
                  i.issue.reactions.plus_one > 0 && (
                    <IconCounter
                      icon="thumbs_up"
                      count={i.issue.reactions.plus_one}
                    />
                  )) ||
                  null}
              </div>

              <a
                href={i.pledge_href}
                className="rounded-md bg-blue-600 px-2 py-0.5 text-sm text-white hover:bg-blue-500"
              >
                Pledge
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="divide-black/7 border-black/7 divide-y border-b border-t">
        {rest.map((i) => (
          <IssueListItem
            key={i.issue.id}
            issue={i.issue}
            org={organization}
            repo={i.repo}
            references={[]}
            pledges={[]}
            showIssueProgress={false}
            canAddRemovePolarLabel={false}
            showPledgeAction={true}
            right={
              <>
                <a href={i.pledge_href} className="font-medium text-blue-600">
                  Pledge
                </a>
              </>
            }
          />
        ))}
      </div>
    </>
  )
}

export default IssuesLookingForFunding
