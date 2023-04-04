import TimeAgo from 'react-timeago'
import {
  IssueReferenceRead,
  OrganizationRead,
  RepositoryRead,
  type IssueRead,
  type PledgeRead,
} from '../api/client'
import { IssueReadWithRelations } from '../api/types'
import { githubIssueUrl } from '../utils'
import IconCounter from './IconCounter'
import IssueActivityBox from './IssueActivityBox'
import IssueLabel, { LabelSchema } from './IssueLabel'
import IssuePledge from './IssuePledge'
import IssueProgress, { Progress } from './IssueProgress'
import IssueReference from './IssueReference'
import PledgeNow from './pledge/PledgeNow'

const IssueListItem = (props: {
  org: OrganizationRead
  repo: RepositoryRead
  issue: IssueRead
  references: IssueReferenceRead[]
  dependents?: IssueReadWithRelations[]
  pledges: PledgeRead[]
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

  const createdAt = new Date(issue_created_at)
  const closedAt = new Date(issue_created_at)

  const havePledge = props.pledges && props.pledges.length > 0
  const haveReference = props.references && props.references?.length > 0
  const havePledgeOrReference = havePledge || haveReference
  const haveDependents = props.dependents && props.dependents.length > 0

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
            <a
              className="font-medium"
              href={githubIssueUrl(props.org.name, props.repo.name, number)}
            >
              {title}
            </a>
            <div className="flex items-center gap-2">
              {props.issue.labels &&
                props.issue.labels.map((label: LabelSchema) => {
                  return <IssueLabel label={label} key={label.id} />
                })}
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {state == 'open' && (
              <p>
                #{number} opened <TimeAgo date={new Date(createdAt)} />
              </p>
            )}
            {state == 'closed' && (
              <p>
                #{number} closed <TimeAgo date={new Date(closedAt)} />
              </p>
            )}
          </div>
          {haveDependents && (
            <div className="text-xs text-gray-500">
              {props.dependents?.map((dep: IssueReadWithRelations) => (
                <p key={dep.id}>
                  Mentioned in{' '}
                  <a
                    href={githubIssueUrl(
                      dep.organization.name,
                      dep.repository.name,
                      dep.number,
                    )}
                  >
                    #{dep.number} {dep.title}
                  </a>
                </p>
              ))}
            </div>
          )}
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

          <PledgeNow issue={props.issue} org={props.org} repo={props.repo} />
        </div>
      </div>

      {havePledgeOrReference && (
        <IssueActivityBox>
          {props.pledges &&
            props.pledges.map((pledge: PledgeRead) => {
              return <IssuePledge pledge={pledge} key={pledge.id} />
            })}

          {props.references &&
            props.references.map((r: IssueReferenceRead) => {
              return (
                <IssueReference
                  org={props.org}
                  repo={props.repo}
                  reference={r}
                  key={r.id}
                />
              )
            })}
        </IssueActivityBox>
      )}
    </div>
  )
}

export default IssueListItem
