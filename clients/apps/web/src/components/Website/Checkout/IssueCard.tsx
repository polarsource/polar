import { type IssueRead } from 'polarkit/api/client'

const IssueCard = ({ issue }: { issue: IssueRead }) => {
  return (
    <>
      <div className="rounded-xl bg-white px-8 py-14 text-center drop-shadow-lg">
        <strong className="text-sm font-medium text-gray-600">
          Issue to be fixed
        </strong>
        <h1 className="my-2.5 text-lg font-normal">{issue.title}</h1>
        <p className="text-sm font-normal text-gray-500">
          #{issue.number} opened {issue.issue_created_at}
        </p>
        <div className="mt-6 flex flex-row justify-center space-x-4">
          <p>Thumbs-up: {issue.reactions.plus_one}</p>
          <p>Comments: {issue.comments}</p>
        </div>
      </div>
    </>
  )
}
export default IssueCard
