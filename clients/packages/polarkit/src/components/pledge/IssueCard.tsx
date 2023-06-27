import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import { PolarTimeAgo } from 'polarkit/components/ui'
import {
  IssueDashboardRead,
  OrganizationPublicRead,
  RepositoryRead,
  type IssueRead,
} from '../../api/client'
import { githubIssueUrl } from '../../github'

const IssueCard = ({
  issue,
  className,
  organization,
  repository,
}: {
  issue: IssueRead | IssueDashboardRead
  className: string
  organization: OrganizationPublicRead
  repository: RepositoryRead
}) => {
  const url = githubIssueUrl(organization.name, repository.name, issue.number)

  return (
    <>
      <div
        className={`flex h-full flex-col content-center justify-center rounded-lg border border-gray-200 py-8 px-6 ${className}`}
      >
        <strong className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Issue to be fixed
        </strong>
        <h1 className="my-2.5 text-xl font-normal">{issue.title}</h1>
        <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
          <a href={url}>#{issue.number}</a> opened{' '}
          <PolarTimeAgo date={new Date(issue.issue_created_at)} />
        </p>
        <div className="mt-3 flex flex-row justify-center space-x-2">
          <p className="w-16 text-sm text-gray-600 dark:text-gray-400">
            <span className="mr-2">👍</span> {issue.reactions.plus_one}
          </p>
          <p className="h-4 w-16 text-sm text-gray-500 dark:text-gray-400">
            <span className="relative top-1 mr-2 inline-block h-4">
              <ChatBubbleLeftIcon className="h-4 w-4" />
            </span>{' '}
            {issue.comments}
          </p>
        </div>
      </div>
    </>
  )
}
export default IssueCard
