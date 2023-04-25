import {
  ExternalGitHubCommitReference,
  ExternalGitHubPullRequestReference,
  IssueReferenceRead,
  IssueReferenceType,
  type PullRequestReference,
} from 'polarkit/api/client'
import {
  GitBranchIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestIcon,
} from 'polarkit/components/icons'
import { githubPullReqeustUrl } from 'polarkit/utils'
import TimeAgo from 'react-timeago'

const IssueReference = (props: {
  orgName: string
  repoName: string
  reference: IssueReferenceRead
}) => {
  const { reference } = props

  if (reference && reference.type === IssueReferenceType.PULL_REQUEST) {
    const pr = reference.payload as PullRequestReference
    const isClosed = !!pr.closed_at
    const isMerged = isClosed && !!pr.merged_at
    const isOpen = !isClosed && !isMerged
    return (
      <Box isClosed={isClosed} isMerged={isMerged} isOpen={isOpen}>
        <IssueReferencePullRequest
          orgName={props.orgName}
          repoName={props.repoName}
          pr={pr}
        />
      </Box>
    )
  }

  if (
    reference &&
    reference.type === IssueReferenceType.EXTERNAL_GITHUB_COMMIT
  ) {
    const commit = reference.payload as ExternalGitHubCommitReference
    return (
      <Box>
        <IssueReferenceExternalGitHubCommit
          orgName={props.orgName}
          commit={commit}
        />
      </Box>
    )
  }

  if (
    reference &&
    reference.type === IssueReferenceType.EXTERNAL_GITHUB_PULL_REQUEST
  ) {
    const pr = reference.payload as ExternalGitHubPullRequestReference
    return (
      <Box>
        <IssueReferenceExternalGitHubPullRequest pr={pr} />
      </Box>
    )
  }

  return <></>
}

export default IssueReference

const Box = (props: {
  isMerged?: boolean
  isClosed?: boolean
  isOpen?: boolean
  children: React.ReactNode
}) => {
  let backgroundColor = 'bg-[#F7F7F7]'
  let borderColor = 'border-#[F0F0F0]'

  if (props.isOpen) {
    backgroundColor = 'bg-[#EDF8F2]'
    borderColor = 'border-#[D6E8DD]'
  } else if (props.isMerged) {
    backgroundColor = 'bg-[#F5F2FC]/90'
    borderColor = 'border-[#633EB7]/4'
  } else if (props.isClosed) {
    backgroundColor = 'bg-red-50'
    borderColor = 'border-red-100'
  }

  return (
    <>
      <div
        className={`rounded-xl p-2 ${backgroundColor} border-[1.5px] ${borderColor} flex justify-between text-sm`}
      >
        <div className="flex w-full items-center justify-between gap-2">
          {props.children}
        </div>
      </div>
    </>
  )
}

const Avatar = (props: { src: string }) => {
  return (
    <img
      className="h-8 w-8 rounded-full border-2 border-white bg-gray-200"
      src={props.src}
    />
  )
}

const IssueReferenceExternalGitHubCommit = (props: {
  orgName: string
  commit: ExternalGitHubCommitReference
}) => {
  const commit = props.commit

  if (!commit) return <></>

  const baseHref = `https://github.com/${commit.organization_name}/${commit.repository_name}`

  const commitHref = `${baseHref}/commit/${commit.sha}`

  const isFork = props.orgName !== commit.organization_name

  return (
    <>
      <LeftSide>
        <Avatar src={commit.author_avatar} />
        <GitBranchIcon />
        <span className="inline-flex space-x-2">
          {commit.branch_name && (
            <a
              className="font-mono"
              href={`${baseHref}/tree/${commit.branch_name}`}
            >
              {isFork && (
                <>
                  {commit.organization_name}/{commit.repository_name}/
                </>
              )}

              {commit.branch_name}
            </a>
          )}

          {!commit.branch_name && (
            <a className="font-mono text-gray-500" href={commitHref}>
              {commit.sha.substring(0, 6)}
            </a>
          )}
        </span>
      </LeftSide>
    </>
  )
}

const IssueReferenceExternalGitHubPullRequest = (props: {
  pr: ExternalGitHubPullRequestReference
}) => {
  const pr = props.pr

  if (!pr) return <></>

  const isMerged = pr.state === 'closed'

  const href = githubPullReqeustUrl(
    pr.organization_name,
    pr.repository_name,
    pr.number,
  )

  return (
    <>
      <LeftSide>
        <Avatar src={pr.author_avatar} />
        {isMerged && <GitMergeIcon />}
        {!isMerged && <GitPullRequestIcon />}
        <a href={href} className="font-medium">
          {pr.title}
        </a>
        <a href={href}>
          {pr.organization_name}/{pr.repository_name}#{pr.number}
        </a>
      </LeftSide>
    </>
  )
}

const LeftSide = (props: { children: React.ReactNode }) => {
  return <div className="flex items-center gap-2">{props.children}</div>
}
const RightSide = (props: { children: React.ReactNode }) => {
  return <div className="flex items-center gap-4">{props.children}</div>
}

const IssueReferencePullRequest = (props: {
  pr: PullRequestReference
  orgName: string
  repoName: string
}) => {
  const pr = props.pr

  if (!pr) return <></>

  const isMerged = pr.state === 'closed' && pr.merged_at
  const isClosed = !isMerged && pr.state === 'closed'
  const isOpen = !isMerged && !isClosed

  const href = githubPullReqeustUrl(props.orgName, props.repoName, pr.number)

  return (
    <>
      <LeftSide>
        <Avatar src={pr.author_avatar} />
        {isMerged && <GitMergeIcon />}
        {isClosed && <GitPullRequestClosedIcon />}
        {isOpen && <GitPullRequestIcon />}
        <a href={href} className="font-medium">
          {pr.title}
        </a>
        {isMerged && pr.merged_at && (
          <>
            <span className="text-sm text-gray-500">
              #{pr.number} merged <TimeAgo date={new Date(pr.merged_at)} />
            </span>
          </>
        )}
        {isOpen && (
          <>
            <span className="text-gray-500">
              #{pr.number} opened <TimeAgo date={new Date(pr.created_at)} />
            </span>
          </>
        )}
        {isClosed && pr.closed_at && (
          <>
            <span className="text-gray-500">
              #{pr.number} closed <TimeAgo date={new Date(pr.closed_at)} />
            </span>
          </>
        )}
      </LeftSide>

      <RightSide>
        <div className="space-x-2">
          {pr.additions !== undefined && (
            <span className="text-green-400">+{pr.additions}</span>
          )}
          {pr.deletions !== undefined && (
            <span className="text-red-400">-{pr.deletions}</span>
          )}
        </div>
      </RightSide>
    </>
  )
}
