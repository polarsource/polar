import {
  IssuePublicRead,
  OrganizationPublicRead,
  RepositoryPublicRead,
} from 'polarkit/api/client'
import { PolarTimeAgo } from 'polarkit/components/ui'
import IssueListItem from '../Dashboard/IssueListItem'

const IssuesLookingForFunding = ({
  organization,
  repositories,
  issues,
}: {
  organization: OrganizationPublicRead
  repositories: RepositoryPublicRead[]
  issues: IssuePublicRead[]
}) => {
  const showIssues = []

  if (issues) {
    for (const i of issues) {
      const repo = repositories?.find(
        (r: RepositoryPublicRead) => r.id === i.repository_id,
      )
      if (!repo) {
        console.log('skip', repo)
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
      <div className="flex flex-col justify-between space-y-4 md:flex-row md:space-y-0 md:space-x-6">
        {top3.map((i) => (
          <div
            className="flex-1 rounded-lg px-4 py-3 text-gray-500 shadow"
            key={i.issue.id}
          >
            <a className="font-medium text-gray-900" href={i.issue_href}>
              {i.issue.title}
            </a>
            <p className="">
              #{i.issue.number} opened{' '}
              <PolarTimeAgo date={new Date(i.issue.issue_created_at)} />
            </p>
            <div className="mt-6 flex items-center justify-between">
              <p>👍 {i.issue.reactions.plus_one}</p>
              <a
                href={i.pledge_href}
                className="rounded-md bg-blue-600 py-0.5 px-2 text-sm text-white hover:bg-blue-500"
              >
                Pledge
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="divide-black/7 border-black/7 divide-y border-t border-b">
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
