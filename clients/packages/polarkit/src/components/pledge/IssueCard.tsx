import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import { HeartIcon, StarIcon } from '@heroicons/react/24/solid'
import {
  Assignee,
  Funding,
  Issue,
  Pledger,
  PullRequest,
  RewardsSummary,
} from '@polar-sh/sdk'
import { generateMarkdownTitle } from 'polarkit/components/Issue'
import {
  Alert,
  IssueBodyRenderer,
  PolarTimeAgo,
} from 'polarkit/components/ui/atoms'
import { getCentsInDollarString } from 'polarkit/money'
import { formatStarsNumber } from 'polarkit/utils'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { Pledgers } from '.'
import { githubIssueUrl } from '../../github'
import { DiffStat } from '../Issue/IssueReference'
import GitMergeIcon from '../icons/GitMergeIcon'
import GitPullRequestClosedIcon from '../icons/GitPullRequestClosedIcon'
import GitPullRequestIcon from '../icons/GitPullRequestIcon'
import Avatar from '../ui/atoms/Avatar'

const IssueCard = ({
  issue,
  htmlBody,
  pledgers,
  currentPledgeAmount,
  className,
  rewards,
  pullRequests,
}: {
  issue: Issue
  htmlBody?: string
  pledgers: Pledger[]
  currentPledgeAmount: number
  className?: string
  rewards?: RewardsSummary
  pullRequests?: PullRequest[]
}) => {
  const url = githubIssueUrl(
    issue.repository.organization.name,
    issue.repository.name,
    issue.number,
  )
  const { repository } = issue
  const { organization } = repository

  const haveRewards = rewards && rewards.receivers.length > 0
  const haveAssignees = issue.assignees && issue.assignees.length > 0
  const haveRewradsOrAssignees = haveRewards || haveAssignees

  return (
    <>
      <h1 className="mb-4 text-center text-4xl text-gray-900 dark:text-gray-300 sm:text-left">
        {generateMarkdownTitle(issue.title)}
      </h1>
      {/* Issue details */}
      <div className="grid grid-cols-1 text-gray-600 dark:text-gray-400 sm:grid-cols-3">
        {/* Left part */}
        <div className="col-span-1 flex	flex-row items-center justify-center gap-2 sm:col-span-2 sm:justify-start	">
          <div>
            <a href={url}>#{issue.number}</a>
          </div>
          {issue.author && (
            <div>
              <a
                href={issue.author.html_url}
                className="flex flex-row items-center gap-2"
                title={`@${issue.author.login}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={issue.author.avatar_url}
                  alt={issue.author.login}
                  className="h-5 w-5 rounded-full"
                />
                <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                  @{issue.author.login}
                </div>
              </a>
            </div>
          )}
          <div className="whitespace-nowrap text-gray-400 dark:text-gray-600">
            <PolarTimeAgo date={new Date(issue.issue_created_at)} />
          </div>
        </div>
        {/* Right part */}
        <div className="flex flex-row items-center justify-center gap-2 sm:justify-end">
          {issue.comments !== undefined && (
            <div className="flex flex-row items-center gap-1">
              <ChatBubbleLeftIcon className="h-5 w-5" />
              {issue.comments}
            </div>
          )}
          {issue.reactions !== undefined && (
            <div className="flex flex-row items-center gap-1">
              <div>👍</div>
              {issue.reactions.plus_one}
            </div>
          )}
        </div>
      </div>
      <hr className="my-4 dark:border-gray-600" />
      {/* Funding goal */}
      <FundingGoal
        funding={issue.funding}
        pledgers={pledgers}
        currentPledgeAmount={currentPledgeAmount}
      />
      <hr className="my-4 dark:border-gray-600" />
      {/* Issue description */}
      <div className="hidden sm:block">
        <div className="relative max-h-80 overflow-hidden">
          {htmlBody && <IssueBodyRenderer html={htmlBody} />}
          <div className="absolute bottom-0 left-0 h-12 w-full bg-gradient-to-b from-transparent to-gray-50 dark:to-gray-950"></div>
        </div>
        <div className="mt-2">
          <a href={url} className="text-blue-500">
            Read more
          </a>
        </div>
        <hr className="my-4 dark:border-gray-600" />
      </div>
      {/* Repository */}
      <div className="grid grid-cols-1 text-gray-600 dark:text-gray-400 sm:grid-cols-3">
        {/* Name/description */}
        <div className="col-span-1 flex flex-row items-center gap-2 sm:col-span-2">
          <div className="min-w-max">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={organization.avatar_url}
              alt={organization.name}
              className="h-8 w-8 rounded-full"
            />
          </div>
          <div className="text-gray-400 dark:text-gray-600">
            <div>
              {organization.name}&nbsp;/&nbsp;
              <span className="font-medium text-gray-600 dark:text-gray-400">
                {repository.name}
              </span>
            </div>
            {repository.description && <div>{repository.description}</div>}
          </div>
        </div>
        {/* Stars */}
        {repository.stars !== undefined && (
          <div className="hidden flex-row items-center justify-end gap-1 sm:flex">
            <StarIcon className="h-5 w-5 text-yellow-500" />
            {formatStarsNumber(repository.stars)}
          </div>
        )}
      </div>
      {/* Rewards */}
      {issue.upfront_split_to_contributors && (
        <div className="my-4 hidden sm:block">
          <Alert color="blue">
            <div className="flex items-center">
              <HeartIcon className="mr-2 h-5 w-5 text-blue-300 dark:text-blue-700" />
              <div className="inline">
                <span className="font-bold">Rewards</span> contributors{' '}
                <span className="font-bold">
                  {issue.upfront_split_to_contributors}%
                </span>{' '}
                of received funds
              </div>
            </div>
          </Alert>
        </div>
      )}

      {haveRewradsOrAssignees && (
        <div className="my-4 hidden items-center space-x-4 sm:flex">
          {/* Rewards Receivers Avatars */}
          {haveRewards && <RewardsReceivers rewards={rewards} />}

          {/* Assignees Avatars */}
          {haveAssignees && <Assignees assignees={issue?.assignees || []} />}
        </div>
      )}

      {pullRequests && pullRequests.length > 0 && (
        <PullRequests pulls={pullRequests} />
      )}
    </>
  )
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(Math.min(value, max), min)
}

const FundingGoalProgress = ({
  sum,
  goal,
  current,
}: {
  sum: number
  goal: number
  current: number
}) => {
  const progress = useMemo(() => clamp((sum / goal) * 100, 1, 100), [sum, goal])

  const currentPledgeProgress = useMemo(
    () => clamp((current / goal) * 100, 1, 100 - progress),
    [current, progress, goal],
  )

  return (
    <div className="mt-1 flex w-full overflow-hidden rounded-md">
      <div className="h-1 bg-blue-700" style={{ width: `${progress}%` }}></div>
      {currentPledgeProgress > 0 && (
        <div
          className="h-1 animate-pulse bg-blue-500"
          style={{ width: `${currentPledgeProgress}%` }}
        ></div>
      )}
      <div className="h-1 flex-1 bg-blue-200 dark:bg-blue-800"></div>
    </div>
  )
}

const FundingGoal = ({
  funding,
  pledgers,
  currentPledgeAmount,
}: {
  funding: Funding
  pledgers: Pledger[]
  currentPledgeAmount: number
}) => {
  const { pledges_sum, funding_goal } = funding

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2">
      {/* Funding amount and goal */}
      <div className="flex flex-col items-center sm:items-start">
        <div className="text-lg text-gray-900 dark:text-gray-300">
          ${getCentsInDollarString(pledges_sum?.amount || 0)}{' '}
          <span className="text-gray-400 dark:text-gray-600">
            {!funding_goal && 'pledged'}
            {funding_goal &&
              `/ ${getCentsInDollarString(funding_goal.amount)} pledged`}
          </span>
        </div>

        {funding_goal && pledges_sum && (
          <FundingGoalProgress
            sum={pledges_sum.amount}
            goal={funding_goal.amount}
            current={currentPledgeAmount}
          />
        )}
      </div>

      {/* Pledgers */}
      <div className="mt-2 flex justify-center md:mt-0 md:justify-end">
        <Pledgers pledgers={pledgers} size="sm" />
      </div>
    </div>
  )
}

const RewardsReceivers = ({ rewards }: { rewards: RewardsSummary }) => (
  <div className="flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-white py-0.5 pl-0.5 pr-2 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">
    <div className="flex flex-shrink-0 -space-x-1.5">
      {rewards.receivers.map((r) => (
        <Avatar avatar_url={r.avatar_url} name={r.name} />
      ))}
    </div>
    <span className="flex-shrink-0 whitespace-nowrap text-blue-600">
      🎉 Rewarded
    </span>
  </div>
)

const Assignees = ({ assignees }: { assignees: Assignee[] }) => (
  <div className="flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 py-0.5 pl-0.5 pr-2 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">
    <div className="flex flex-shrink-0 -space-x-1.5">
      {assignees.map((a) => (
        <Avatar avatar_url={a.avatar_url} name={a.login} />
      ))}
    </div>
    <span className="flex-shrink-0 whitespace-nowrap text-blue-600">
      Assigned
    </span>
  </div>
)

const PullRequests = ({ pulls }: { pulls: PullRequest[] }) => (
  <div className="hidden space-y-2 sm:block">
    {pulls.map((pr) => (
      <Pull pr={pr} key={pr.id} />
    ))}
  </div>
)

const Pull = ({ pr }: { pr: PullRequest }) => {
  const merged = pr.is_merged
  const closed = pr.is_closed && !merged
  const open = !merged && !closed

  return (
    <div className="flex w-full items-center gap-2 overflow-hidden text-sm text-gray-600 dark:text-gray-400">
      <div
        className={twMerge(
          'h-6 w-6 rounded-lg border p-0.5',
          merged
            ? 'border-purple-200 bg-purple-100 text-purple-600 dark:border-purple-500/40 dark:bg-purple-500/40 dark:text-purple-200'
            : '',
          closed
            ? 'border-red-200 bg-red-100 text-red-500 dark:border-red-500/30 dark:bg-red-500/30 dark:text-red-300'
            : '',
          open
            ? 'border-green-200 bg-green-100 text-[#26A869] dark:border-green-500/30 dark:bg-green-500/30 dark:text-green-300'
            : '',
        )}
      >
        {merged && <GitMergeIcon />}
        {closed && <GitPullRequestClosedIcon />}
        {open && <GitPullRequestIcon />}
      </div>
      <div className="whitespace-nowrap font-bold ">#{pr.number}</div>
      <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap ">
        {pr.title}
      </div>
      <div className="flex-shrink-0">
        <DiffStat additions={pr.additions} deletions={pr.deletions} />
      </div>
      {pr.author && (
        <Avatar avatar_url={pr.author.avatar_url} name={pr.author.login} />
      )}
    </div>
  )
}

export default IssueCard
