import { default as IssueListItem, type Issue } from './IssueListItem'
import {
  type IssueRead,
  type PullRequestSchema,
  type RewardSchema,
} from '../api/client'
import { useState } from 'react'

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
  pullRequests: PullRequestSchema[],
): PullRequestSchema[] => {
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
  pullRequests: PullRequestSchema[]
  rewards: RewardSchema[]
}) => {
  const { issues, pullRequests, rewards } = props

  if (!issues) return <div>Loading issues...</div>
  if (!pullRequests) return <div>Loading pull requests...</div>
  if (!rewards) return <div>Loading rewards...</div>

  const [searchQuery, setSearchQuery] = useState('')
  const handleQueryChange = (e: React.FormEvent<HTMLInputElement>) =>
    setSearchQuery(e.target.value)

  const sortByActivity = (a: IssueRead, b: IssueRead) => {
    const aDate = lastTimestamp(a)
    const bDate = lastTimestamp(b)
    return bDate.getTime() - aDate.getTime()
  }

  const filterPullRequest = (pr: PullRequestSchema): boolean => {
    const query = searchQuery.toLowerCase()
    // PR Title
    if (pr.title.toLowerCase().indexOf(query) > -1) {
      return true
    }
    // PR username
    if (pr.author.login.toLowerCase().indexOf(query) > -1) {
      return true
    }
    return false
  }

  const filterByQuery = (issue: Issue): boolean => {
    if (searchQuery.length === 0) {
      return true
    }

    const query = searchQuery.toLowerCase()

    // Issue Title
    if (issue.title.toLowerCase().indexOf(query) > -1) {
      return true
    }

    // Issue Number
    if (issue.number.toString().indexOf(query) > -1) {
      return true
    }

    // Issue username
    if (issue.author.login.toLowerCase().indexOf(query) > -1) {
      return true
    }

    // If any associated PR matches
    // TODO: Do we also want to filter the PRs?
    if (issue.pullRequests.find(filterPullRequest)) {
      return true
    }

    return false
  }

  let sortedIssues = issues
    .map((issue): Issue => {
      return {
        ...issue,
        pullRequests: pullRequestsForIssue(issue, pullRequests),
        rewards: rewards.filter((reward) => reward.issue_id === issue.id),
      }
    })
    .filter(filterByQuery)
    .sort(sortByActivity)

  return (
    <div className="space-y-2 divide-y divide-gray-200">
      <form>
        <input
          type="text"
          placeholder="Search..."
          className="border-2"
          value={searchQuery}
          onChange={handleQueryChange}
        />
      </form>

      {sortedIssues.map((issue) => {
        return <IssueListItem issue={issue} key={issue.id} />
      })}
    </div>
  )
}

export default IssueList
