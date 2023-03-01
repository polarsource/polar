import { default as IssueListItem, type Issue } from "./IssueListItem"
import { type IssueSchema, type PullRequestSchema, type RewardSchema } from "polarkit/api/client"

const lastTimestamp = (issue: IssueSchema) => {
    const timestamps = [
        new Date(issue.issue_created_at),
        new Date(issue.issue_closed_at),
        new Date(issue.issue_modified_at),
        // TODO: Latest comment, commit, etc.
    ]

    const sorted = timestamps
        .filter((d) => Boolean(d))
        .sort((a, b) => { return b.getTime() - a.getTime() })

    return sorted[0]
}

const pullRequestsForIssue = (issue: IssueSchema, pullRequests: PullRequestSchema[]): PullRequestSchema[] => {
    const re = new RegExp(`(Close|Closes|Closed|Fix|Fixes|Fixed|Resolve|Resolves|Resolved) #${issue.number}(?![0-9])`, 'gi')

    const filtered = pullRequests.filter((pr) => {
        if (re.test(pr.body)) return true
        return false
    })

    return filtered
};

const IssueList = (props: {
    issues: IssueSchema[],
    pullRequests: PullRequestSchema[],
    rewards: RewardSchema[],
}) => {
    const { issues, pullRequests, rewards } = props

    if (!issues) return <div>Loading issues...</div>
    if (!pullRequests) return <div>Loading pull requests...</div>
    if (!rewards) return <div>Loading rewards...</div>

    const sortByActivity = (a: IssueSchema, b: IssueSchema) => {
        const aDate = lastTimestamp(a)
        const bDate = lastTimestamp(b)
        return bDate.getTime() - aDate.getTime()
    }

    let sortedIssues = issues.sort(sortByActivity).map((issue): Issue => {
        return {
            ...issue,
            pullRequests: pullRequestsForIssue(issue, pullRequests),
            rewards: rewards.filter((reward) => reward.issue_id === issue.id),
        }
    })

    return (
        <div className="space-y-2 divide-y divide-gray-200">
            {sortedIssues.map((issue) => {
                return <IssueListItem issue={issue} key={issue.id} />
            })}
        </div>
    )
}

export default IssueList
