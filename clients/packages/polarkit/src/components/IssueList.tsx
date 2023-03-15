import {
  type IssueRead,
  type PullRequestRead,
  type RewardRead,
} from '../api/client'
import { default as IssueListItem, type Issue } from './IssueListItem'

const lastTimestamp = (issue: IssueRead) => {
  const timestamps = [
    new Date(issue.issue_created_at),
    // TODO: Latest comment, commit, etc.
  ]

  if (issue.issue_closed_at) {
    timestamps.push(new Date(issue.issue_closed_at))
  }
  if (issue.issue_modified_at) {
    timestamps.push(new Date(issue.issue_modified_at))
  }

  const sorted = timestamps
    .filter((d) => Boolean(d))
    .sort((a, b) => {
      return b.getTime() - a.getTime()
    })

  return sorted[0]
}

const pullRequestsForIssue = (
  issue: IssueRead,
  pullRequests: PullRequestRead[],
): PullRequestRead[] => {
  const re = new RegExp(
    `(Close|Closes|Closed|Fix|Fixes|Fixed|Resolve|Resolves|Resolved) #${issue.number}(?![0-9])`,
    'gi',
  )

  const filtered = pullRequests.filter((pr) => {
    if (pr.body && re.test(pr.body)) return true
    return false
  })

  return filtered
}

const IssueList = (props: {
  issues: IssueRead[]
  pullRequests: PullRequestRead[]
  rewards: RewardRead[]
}) => {
  const { issues, pullRequests, rewards } = props
  if (!issues) return <div>Loading issues...</div>
  if (!pullRequests) return <div>Loading pull requests...</div>
  if (!rewards) return <div>Loading rewards...</div>

  const sortByActivity = (a: IssueRead, b: IssueRead) => {
    const aDate = lastTimestamp(a)
    const bDate = lastTimestamp(b)
    return bDate.getTime() - aDate.getTime()
  }

  let sortedIssues = issues.map((issue): Issue => {
    return {
      ...issue,
      pullRequests: pullRequestsForIssue(issue, pullRequests),
      rewards: rewards.filter((reward) => reward.issue_id === issue.id),
    }
  })
  //.filter(filterByQuery)
  // .sort(sortByActivity)

  return (
    <div className="space-y-2 divide-y divide-gray-200">
      {sortedIssues.map((issue) => {
        return <IssueListItem issue={issue} key={issue.id} />
      })}
    </div>
  )
}

export default IssueList
