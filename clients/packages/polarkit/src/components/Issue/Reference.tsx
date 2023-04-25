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
import { classNames, githubPullReqeustUrl } from 'polarkit/utils'
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
      <Box>
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

const Box = (props: { children: React.ReactNode }) => {
  return (
    <>
      <div className={`flex justify-between text-sm`}>
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
      <RightSide>
        <Avatar src={commit.author_avatar} />
      </RightSide>
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
        {isMerged && <GitMergeIcon />}
        {!isMerged && <GitPullRequestIcon />}
        <a href={href} className="font-medium">
          {pr.title}
        </a>
        <a href={href}>
          {pr.organization_name}/{pr.repository_name}#{pr.number}
        </a>
      </LeftSide>
      <RightSide>
        <Avatar src={pr.author_avatar} />
      </RightSide>
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
        <DiffStat additions={pr.additions} deletions={pr.deletions} />
        <Avatar src={pr.author_avatar} />
      </RightSide>
    </>
  )
}

const DiffStat = (props: {
  additions: number | undefined
  deletions: number | undefined
}) => {
  /*
   * Generate the diffstat boxes as seen on Github.
   *
   * We're mimicking how these boxes are generated on Github vs. solely percentage based.
   * After some experimentation the logic and rules are:
   * - 5 boxes
   * - Additions (green) > Deletions (red) > Empty (gray)
   * - A box can only be claimed by full 20% steps, i.e 39% is 1 box, 40% is 2 boxes
   * - Resulting in the last box always being gray unless it's a perfect 100% of deletions or additions
   */
  const boxCount = 5
  const threshold = 1 / boxCount
  const additions = props.additions || 0
  const deletions = props.deletions || 0
  const total = additions + deletions

  // Default to all empty, e.g opened branch/PR with no changes
  let emptyBoxes = boxCount
  let additionBoxes = 0
  let deletionBoxes = 0
  if (total > 0) {
    additionBoxes = Math.floor(additions / total / threshold)
    deletionBoxes = Math.floor(deletions / total / threshold)
    emptyBoxes = boxCount - additionBoxes - deletionBoxes
  }

  const generateDiffBox = (className: string, boxes: number) => {
    if (boxes <= 0) return <></>

    const iterations = [...Array(boxes)]
    return iterations.map((_, i) => {
      return (
        <span
          key={i}
          className={classNames(
            className,
            'ml-0.5 inline-block h-2.5 w-2.5 border',
          )}
        >
          {' '}
        </span>
      )
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-green-400">+{props.additions}</span>
      <span className="text-red-400">-{props.deletions}</span>
      <span>
        {generateDiffBox('divide-green-300 bg-green-200', additionBoxes)}
        {generateDiffBox('divide-red-300 bg-red-200', deletionBoxes)}
        {generateDiffBox('divide-gray-300 bg-gray-200', emptyBoxes)}
      </span>
    </div>
  )
}
