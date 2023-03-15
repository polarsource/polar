import ReactTimeAgo from 'react-time-ago'
import IconCounter from './IconCounter'
import IssueLabel from './IssueLabel'

import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'
import {
  OrganizationRead,
  RepositoryRead,
  type IssueRead,
  type PullRequestRead,
  type RewardRead,
} from '../api/client'
import IssueActivityBox from './IssueActivityBox'
import IssueProgress from './IssueProgress'
import IssuePullRequest from './IssuePullRequest'
import IssueReward from './IssueReward'

TimeAgo.addDefaultLocale(en)

const IssueListItem = (props: {
  issue: IssueRead
  pullRequests: PullRequestRead[]
  rewards: RewardRead[]
  org: OrganizationRead
  repo: RepositoryRead
}) => {
  const {
    title,
    number,
    state,
    issue_created_at,
    reactions,
    comments,
    issue_closed_at,
  } = props.issue

  const href = `https://github.com/${props.org.name}/${props.repo.name}/issues/${number}`
  const createdAt = new Date(issue_created_at)
  const closedAt = new Date(issue_created_at)

  const haveRewardOrPullRequest =
    props.rewards.length > 0 || props.pullRequests.length > 0

  const showCommentsCount = !!(comments && comments > 0)
  const showReactionsThumbs = !!(reactions.plus_one > 0)

  // TODO!
  const isCompleted = !!issue_closed_at
  const isBuilding = isCompleted === false

  return (
    <div>
      <div className="flex items-center justify-between gap-4 py-4">
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
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-6">
            {showCommentsCount && (
              <IconCounter icon="comments" count={comments} />
            )}
            {showReactionsThumbs && (
              <IconCounter icon="thumbs_up" count={reactions.plus_one} />
            )}
          </div>

          {isCompleted && <IssueProgress progress="completed" />}
          {isBuilding && <IssueProgress progress="building" />}
        </div>
      </div>

      {haveRewardOrPullRequest && (
        <IssueActivityBox>
          {props.rewards.map((reward: RewardRead) => {
            return <IssueReward reward={reward} key={reward.id} />
          })}

          {props.pullRequests.map((pr: PullRequestRead) => {
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
