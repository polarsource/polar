import {
  ExternalGitHubCommitReference,
  ExternalGitHubPullRequestReference,
  IssueReferenceRead,
  IssueReferenceType,
  type PullRequestReference,
} from '@polar-sh/sdk'
import {
  GitBranchIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestIcon,
} from 'polarkit/components/icons'
import { PolarTimeAgo } from 'polarkit/components/ui/atoms'
import { githubPullReqeustUrl } from 'polarkit/github'
import { dateOrString } from 'polarkit/utils'
import { twMerge } from 'tailwind-merge'
import { generateMarkdownTitle } from './markdown'

const IssueReference = (props: {
  orgName: string
  repoName: string
  reference: IssueReferenceRead
}) => {
  const { reference } = props

  if (
    reference &&
    reference.type === IssueReferenceType.PULL_REQUEST &&
    reference.pull_request_reference
  ) {
    return (
      <Box>
        <IssueReferencePullRequest
          orgName={props.orgName}
          repoName={props.repoName}
          pr={reference.pull_request_reference}
        />
      </Box>
    )
  }

  if (
    reference &&
    reference.type === IssueReferenceType.EXTERNAL_GITHUB_COMMIT &&
    reference.external_github_commit_reference
  ) {
    return (
      <Box>
        <IssueReferenceExternalGitHubCommit
          orgName={props.orgName}
          commit={reference.external_github_commit_reference}
        />
      </Box>
    )
  }

  if (
    reference &&
    reference.type === IssueReferenceType.EXTERNAL_GITHUB_PULL_REQUEST &&
    reference.external_github_pull_request_reference
  ) {
    return (
      <Box>
        <IssueReferenceExternalGitHubPullRequest
          pr={reference.external_github_pull_request_reference}
        />
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
      className="h-5 w-5 rounded-full border border-white bg-gray-200"
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
        <span className="dark:text-polar-200">
          <GitBranchIcon />
        </span>
        <span className="inline-flex space-x-2">
          {commit.branch_name && (
            <a
              className="dark:text-polar-100 font-mono"
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
            <a
              className="dark:text-polar-400 font-mono text-gray-500"
              href={commitHref}
            >
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
  const markdownTitle = generateMarkdownTitle(pr.title)

  return (
    <>
      <LeftSide>
        <span
          className={twMerge(
            isMerged
              ? 'border-purple-200 bg-purple-100 text-purple-600 dark:border-purple-500/40 dark:bg-purple-500/40 dark:text-purple-200'
              : '',
            !isMerged
              ? 'border-red-200 bg-red-100 text-red-500 dark:border-red-500/30 dark:bg-red-500/30 dark:text-red-300'
              : '',
            'h-6 w-6 rounded-lg border p-0.5',
          )}
        >
          {isMerged && <GitMergeIcon />}
          {!isMerged && <GitPullRequestIcon />}
        </span>
        <a href={href} className="font-medium">
          {markdownTitle}
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
  return (
    <div className="flex flex-wrap items-center gap-2">{props.children}</div>
  )
}
const RightSide = (props: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-shrink-0 items-center justify-between gap-4">
      {props.children}
    </div>
  )
}

interface PullRequestFormatting {
  label: 'opened' | 'closed' | 'merged'
  timestamp?: Date
  titleClasses: string
  iconClasses: string
}

const IssueReferencePullRequest = (props: {
  pr: PullRequestReference
  orgName: string
  repoName: string
}) => {
  const pr = props.pr

  if (!pr) return <></>

  let isMerged = false
  let isClosed = false
  let isOpen = false

  let formatting: PullRequestFormatting
  if (pr.state === 'closed' && pr.merged_at) {
    isMerged = true
    formatting = {
      label: 'merged',
      timestamp: dateOrString(pr.merged_at),
      titleClasses: '',
      iconClasses:
        'bg-purple-100 border-purple-200 text-purple-600 dark:bg-purple-500/40 dark:border-purple-500/40 dark:text-purple-200',
    }
  } else if (!isMerged && pr.state === 'closed') {
    isClosed = true
    formatting = {
      label: 'closed',
      timestamp: pr.closed_at ? dateOrString(pr.closed_at) : undefined,
      titleClasses: '',
      iconClasses:
        'bg-red-100 border-red-200 text-red-500 dark:text-red-300 dark:bg-red-500/30 dark:border-red-500/30',
    }
  } else if (pr.is_draft) {
    isOpen = true
    formatting = {
      label: 'opened',
      timestamp: dateOrString(pr.created_at),
      titleClasses: '',
      iconClasses:
        'bg-gray-100 border-gray-200 text-gray-500 dark:text-polar-300 dark:bg-polar-500/30 dark:border-polar-500/30',
    }
  } else {
    isOpen = true
    formatting = {
      label: 'opened',
      timestamp: dateOrString(pr.created_at),
      titleClasses: '',
      iconClasses:
        'bg-green-100 border-green-200 text-[#26A869] dark:bg-green-500/30 dark:border-green-500/30 dark:text-green-300',
    }
  }

  const href = githubPullReqeustUrl(props.orgName, props.repoName, pr.number)
  const markdownTitle = generateMarkdownTitle(pr.title)

  return (
    <>
      <LeftSide>
        <span
          className={twMerge(
            formatting.iconClasses,
            'h-6 w-6 rounded-lg border p-0.5',
          )}
        >
          {isMerged && <GitMergeIcon />}
          {isClosed && <GitPullRequestClosedIcon />}
          {isOpen && <GitPullRequestIcon />}
        </span>
        <a
          href={href}
          className={twMerge(formatting.titleClasses, 'font-medium')}
        >
          {markdownTitle}
        </a>
        <span className="dark:text-polar-400 overflow-hidden whitespace-pre text-sm text-gray-500">
          #{pr.number} {formatting.label}{' '}
          {formatting.timestamp && <PolarTimeAgo date={formatting.timestamp} />}
        </span>
      </LeftSide>

      <RightSide>
        <DiffStat additions={pr.additions} deletions={pr.deletions} />
        <Avatar src={pr.author_avatar} />
      </RightSide>
    </>
  )
}

export const DiffStat = (props: {
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
          className={twMerge(
            className,
            'ml-0.5 inline-block h-2.5 w-2.5 border dark:border-white/10',
          )}
        >
          {' '}
        </span>
      )
    })
  }

  return (
    <div className="hidden flex-shrink-0 flex-nowrap items-center gap-2 lg:flex">
      <span className="text-green-400 dark:text-green-500">
        +{props.additions}
      </span>
      <span className="text-red-400 dark:text-red-500">-{props.deletions}</span>
      <span>
        {generateDiffBox('bg-green-200 dark:bg-green-400/50', additionBoxes)}
        {generateDiffBox('bg-red-200 dark:bg-red-400/50', deletionBoxes)}
        {generateDiffBox('bg-gray-200 dark:bg-polar-400/50', emptyBoxes)}
      </span>
    </div>
  )
}
