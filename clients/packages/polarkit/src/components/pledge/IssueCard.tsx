import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import TimeAgo from 'react-timeago'
import { type IssueRead } from '../../api/client'

const IssueCard = ({ issue, bg }: { issue: IssueRead; bg: string }) => {
  return (
    <>
      <div className={`h-full rounded-lg border px-8 py-14 text-center ${bg}`}>
        <strong className="text-sm font-medium text-gray-600">
          Issue to be fixed
        </strong>
        <h1 className="my-2.5 text-lg font-normal">{issue.title}</h1>
        <p className="text-sm font-normal text-gray-500">
          #{issue.number} opened{' '}
          <TimeAgo date={new Date(issue.issue_created_at)} />
        </p>
        <div className="mt-6 flex flex-row justify-center space-x-4">
          <p className="w-16 text-sm text-gray-600">
            <span className="mr-2">👍</span> {issue.reactions.plus_one}
          </p>
          <p className="h-4 w-16 text-sm text-gray-600">
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
