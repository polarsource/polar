// TODO: This is a placeholder until we've designed the real API
type PullRequestState = 'open' | 'closed' | 'merged'
type IssueState = 'open' | 'closed' | 'rewarded'

const IssuePullRequest = (props: {
    pullRequestState: PullRequestState,
    issueState: IssueState,
}) => {

    let backgroundColor = 'bg-gray-800'
    let borderColor = 'border-gray-800'

    if (props.pullRequestState == 'open') {
        backgroundColor = 'bg-green-50'
        borderColor = 'border-green-100'
    } else if (props.pullRequestState == 'merged') {
        backgroundColor = 'bg-purple-50'
        borderColor = 'border-purple-100'
    }

    return (<>
        <div className={`rounded-xl p-2 ${backgroundColor} border-2 ${borderColor} flex justify-between`} >
            <div className="flex items-center gap-2">
                <div className="bg-gray-200 rounded-full h-8 w-8 border-2 border-white"></div>
                <strong>Add more SQL Syntax</strong>
                <span className="text-gray-500">#1234 opened 2 days ago</span>
            </div>
            <div className="flex items-center gap-4">
                <div className="space-x-2">
                    <span className="text-green-400">+318</span>
                    <span className="text-red-400">-185</span>
                </div>
                {props.pullRequestState == 'open' && <div className="text-white bg-green-600 py-1 px-2 rounded-md text-sm">Review</div>}
                {props.pullRequestState == 'merged' && <div className="text-white bg-purple-600 py-1 px-2 rounded-md text-sm">Reward</div>}
            </div>
        </div>
    </>
    )
}

export default IssuePullRequest
