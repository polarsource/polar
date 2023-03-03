import IconCounter from './IconCounter'
import IssueLabel from './IssueLabel'
import ReactTimeAgo from 'react-time-ago'

import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'
import IssueReward from './IssueReward'
import {
  type PullRequestSchema,
  type RewardSchema,
  type IssueRead,
} from '../api/client'
import IssuePullRequest from './IssuePullRequest'
import IssueActivityBox from './IssueActivityBox'

TimeAgo.addDefaultLocale(en)

export type Issue = IssueRead & {
  pullRequests: PullRequestSchema[]
  rewards: RewardSchema[]
}

const IssueListItem = (props: { issue: Issue }) => {
  const { title, number, state, issue_created_at, reactions, comments } =
    props.issue
  const href = `https://github.com/todo/todo/issues/${number}`
  const createdAt = new Date(issue_created_at)
  const closedAt = new Date(issue_created_at)

  const haveRewardOrPullRequest =
    props.issue.rewards.length > 0 || props.issue.pullRequests.length > 0

  return (
    <div>
      <div className="py-4 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-4">
            <a className="font-medium" href={href}>
              {title}
            </a>
            <div className="flex items-center gap-2">
              {props.issue.labels &&
                props.issue.labels.map((label) => {
                  return <IssueLabel label={label} key={label.id} />
                })}
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {state == 'open' && (
              <p>
                #{number} opened <ReactTimeAgo date={createdAt} />
              </p>
            )}
            {state == 'closed' && (
              <p>
                #{number} closed <ReactTimeAgo date={closedAt} />
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          {comments && comments > 0 && (
            <IconCounter icon="💬" count={comments} />
          )}
          {reactions.plus_one > 0 && (
            <IconCounter icon="👍" count={reactions.plus_one} />
          )}
        </div>
      </div>

      {haveRewardOrPullRequest && (
        <IssueActivityBox>
          {props.issue.rewards.map((reward: RewardSchema) => {
            return <IssueReward reward={reward} key={reward.id} />
          })}

          {props.issue.pullRequests.map((pr: PullRequestSchema) => {
            return (
              <IssuePullRequest
                issue={props.issue}
                pullRequest={pr}
                key={pr.number}
              />
            )
          })}
        </IssueActivityBox>
      )}
    </div>
  )
}

export default IssueListItem
