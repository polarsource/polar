import { type IssueSchema, type PullRequestSchema } from "../api/client"
import ReactTimeAgo from 'react-time-ago'

const IssuePullRequest = (props: {
    issue: IssueSchema,
    pullRequest: PullRequestSchema,
}) => {
    const pr = props.pullRequest

    if (!pr) return <></>

    let backgroundColor = 'bg-gray-800'
    let borderColor = 'border-gray-800'

    if (pr.state == 'open') {
        backgroundColor = 'bg-green-50'
        borderColor = 'border-green-100'
    } else if (pr.state == 'closed') {
        backgroundColor = 'bg-purple-50'
        borderColor = 'border-purple-100'
    }

    return (<>
        <div className={`rounded-xl p-2 ${backgroundColor} border-2 ${borderColor} flex justify-between`} >
            <div className="flex items-center gap-2">
                <img className="bg-gray-200 rounded-full h-8 w-8 border-2 border-white" src={pr.author.avatar_url} />
                <strong>{pr.title}</strong>
                <span className="text-gray-500">#{pr.number} opened <ReactTimeAgo date={new Date(pr.issue_created_at)} /></span>
            </div>
            <div className="flex items-center gap-4">
                <div className="space-x-2">
                    {pr.additions !== undefined && <span className="text-green-400">+{pr.additions}</span>}
                    {pr.deletions !== undefined && <span className="text-red-400">-{pr.deletions}</span>}
                </div>
                {pr.state == 'open' && <a href="#" className="text-white bg-green-600 py-1 px-2 rounded-md text-sm">Review</a>}
                {pr.state == 'closed' && <a href="#" className="text-white bg-purple-600 py-1 px-2 rounded-md text-sm">Reward</a>}
            </div>
        </div>
    </>
    )
}

export default IssuePullRequest
