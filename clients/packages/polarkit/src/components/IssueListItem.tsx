import ReactTimeAgo from 'react-time-ago'
import IconCounter from './IconCounter'
import IssueLabel from './IssueLabel'

import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'
import {
  IssueReferenceRead,
  OrganizationRead,
  RepositoryRead,
  type IssueRead,
  type PledgeRead,
} from '../api/client'
import IssueActivityBox from './IssueActivityBox'
import IssuePledge from './IssuePledge'
import IssueProgress, { Progress } from './IssueProgress'
import IssueReference from './IssueReference'

TimeAgo.addDefaultLocale(en)

const IssueListItem = (props: {
  org: OrganizationRead
  repo: RepositoryRead
  issue: IssueRead
  references: IssueReferenceRead[]
  pledges?: PledgeRead[]
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

  const issue = props.issue

  const href = `https://github.com/${props.org.name}/${props.repo.name}/issues/${number}`
  const createdAt = new Date(issue_created_at)
  const closedAt = new Date(issue_created_at)

  const havePledgeOrPullRequest =
    props.pledges?.length > 0 || props.references?.length > 0

  const showCommentsCount = !!(comments && comments > 0)
  const showReactionsThumbs = !!(reactions.plus_one > 0)

  const getissueProgress = (): Progress => {
    if (!!issue_closed_at) {
      return 'completed'
    }
    if (props.references?.length > 0) {
      return 'pull_request'
    }
    return 'backlog'
  }
  const issueProgress = getissueProgress()

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

          <IssueProgress progress={issueProgress} />
        </div>
      </div>

      {havePledgeOrPullRequest && (
        <IssueActivityBox>
          {props.pledges &&
            props.pledges.map((pledge: PledgeRead) => {
              return <IssuePledge pledge={pledge} key={pledge.id} />
            })}

          {props.references &&
            props.references.map((r: IssueReferenceRead) => {
              return <IssueReference issue={issue} reference={r} key={r.id} />
            })}
        </IssueActivityBox>
      )}
    </div>
  )
}

export default IssueListItem
