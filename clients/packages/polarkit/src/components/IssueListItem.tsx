import TimeAgo from 'react-timeago'
import PledgeNow from '../../../../apps/web/src/components/Pledge/PledgeNow'
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
      <div className="hover:bg-gray-75 group flex items-center justify-between gap-4 py-4 px-2 pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-4">
            <a
              className="text-md font-medium"
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
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-6">
            {showCommentsCount && (
              <IconCounter icon="comments" count={comments} />
            )}
            {showReactionsThumbs && (
              <IconCounter icon="thumbs_up" count={reactions.plus_one} />
            )}
          </div>

          <IssueProgress progress={issueProgress} />

          <div className="group-hover:delay-0 -ml-6 w-0 overflow-hidden opacity-0 delay-150 duration-100 group-hover:ml-0 group-hover:w-20 group-hover:opacity-100 group-hover:transition-all group-hover:duration-200 group-hover:ease-in-out">
            <PledgeNow issue={props.issue} org={props.org} repo={props.repo} />
          </div>
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
