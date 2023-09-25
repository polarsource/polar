import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import { HeartIcon, StarIcon } from '@heroicons/react/24/solid'
import { generateMarkdownTitle } from 'polarkit/components/Issue'
import { Alert, IssueBodyRenderer, PolarTimeAgo } from 'polarkit/components/ui'
import { getCentsInDollarString } from 'polarkit/money'
import { formatStarsNumber } from 'polarkit/utils'
import { useMemo } from 'react'
import { Pledgers } from '.'
import { Funding, Issue, Pledger } from '../../api/client'
import { githubIssueUrl } from '../../github'

const IssueCard = ({
  issue,
  htmlBody,
  pledgers,
  currentPledgeAmount,
  className,
}: {
  issue: Issue
  htmlBody?: string
  pledgers: Pledger[]
  currentPledgeAmount: number
  className?: string
}) => {
  const url = githubIssueUrl(
    issue.repository.organization.name,
    issue.repository.name,
    issue.number,
  )
  const { repository } = issue
  const { organization } = repository

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
      <Pledgers pledgers={pledgers} size="sm" />
    </div>
  )
}

export default IssueCard
