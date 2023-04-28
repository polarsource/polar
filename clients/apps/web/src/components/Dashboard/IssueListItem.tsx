import {
  IssueDashboardRead,
  IssueReferenceRead,
  IssueStatus,
  OrganizationRead,
  RepositoryRead,
  type PledgeRead,
} from 'polarkit/api/client'
import { IssueReadWithRelations } from 'polarkit/api/types'
import {
  IssueActivityBox,
  IssueListItemDecoration,
} from 'polarkit/components/Issue'
import { githubIssueUrl } from 'polarkit/utils'
import TimeAgo from 'react-timeago'
import PledgeNow from '../Pledge/PledgeNow'
import IconCounter from './IconCounter'
import IssueLabel, { LabelSchema } from './IssueLabel'
import IssueProgress, { Progress } from './IssueProgress'

const IssueListItem = (props: {
  org: OrganizationRead
  repo: RepositoryRead
  issue: IssueDashboardRead
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

  const isDependency = props.dependents && props.dependents.length > 0

  const createdAt = new Date(issue_created_at)
  const closedAt = new Date(issue_created_at)

  const havePledge = props.pledges && props.pledges.length > 0
  const haveReference = props.references && props.references?.length > 0
  const havePledgeOrReference = havePledge || haveReference
  const haveDependents = props.dependents && props.dependents.length > 0

  const showCommentsCount = !!(comments && comments > 0)
  const showReactionsThumbs = !!(reactions.plus_one > 0)

  const getissueProgress = (): Progress => {
    if (props.issue.progress === IssueStatus.BACKLOG) {
      return 'backlog'
    }
    if (props.issue.progress === IssueStatus.BUILDING) {
      return 'building'
    }
    if (props.issue.progress === IssueStatus.PULL_REQUEST) {
      return 'pull_request'
    }
    if (props.issue.progress === IssueStatus.COMPLETED) {
      return 'completed'
    }
  }
  const issueProgress = getissueProgress()

  const showPledgeAction =
    isDependency && props.issue.progress !== IssueStatus.COMPLETED

  return (
    <div>
      <div className="hover:bg-gray-75 group flex items-center justify-between gap-4 py-4 px-2 pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <a
              className="text-md text-nowrap font-medium"
              href={githubIssueUrl(props.org.name, props.repo.name, number)}
            >
              {title}
            </a>

            {props.issue.labels &&
              props.issue.labels.map((label: LabelSchema) => {
                return <IssueLabel label={label} key={label.id} />
              })}
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

          {showPledgeAction && (
            <div className="group-hover:delay-0 -ml-6 w-0 overflow-hidden opacity-0 delay-150 duration-100 group-hover:ml-0 group-hover:w-20 group-hover:opacity-100 group-hover:transition-all group-hover:duration-200 group-hover:ease-in-out">
              <PledgeNow
                issue={props.issue}
                org={props.org}
                repo={props.repo}
              />
            </div>
          )}
        </div>
      </div>

      {havePledgeOrReference && (
        <IssueActivityBox>
          <IssueListItemDecoration
            orgName={props.org.name}
            repoName={props.repo.name}
            pledges={props.pledges}
            references={props.references}
          />
        </IssueActivityBox>
      )}
    </div>
  )
}

export default IssueListItem
