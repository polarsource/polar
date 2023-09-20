import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import { StarIcon } from '@heroicons/react/24/solid'
import { generateMarkdownTitle } from 'polarkit/components/Issue'
import { PolarTimeAgo } from 'polarkit/components/ui'
import { getCentsInDollarString } from 'polarkit/money'
import { formatStarsNumber } from 'polarkit/utils'
import { useMemo } from 'react'
import { Funding, Issue } from '../../api/client'
import { githubIssueUrl } from '../../github'

const IssueCard = ({
  issue,
  className,
  currentPledgeAmount,
}: {
  issue: Issue
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
        currentPledgeAmount={currentPledgeAmount}
      />
      <hr className="my-4 dark:border-gray-600" />
      {/* Issue description */}
      <div className="text-gray-600 dark:text-gray-400">
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Amet
          cursus sit amet dictum sit amet justo donec enim. Tempus iaculis urna
          id volutpat lacus laoreet non curabitur. Sed ullamcorper morbi
          tincidunt ornare. Velit dignissim sodales ut eu sem integer vitae
          justo eget. In egestas erat imperdiet sed euismod nisi porta lorem.
          Nunc scelerisque viverra mauris in aliquam. Volutpat blandit aliquam
          etiam erat velit scelerisque in dictum. Euismod quis viverra nibh cras
          pulvinar mattis. Sed viverra ipsum nunc aliquet bibendum enim
          facilisis gravida neque. Lobortis feugiat vivamus at augue eget arcu.
        </p>
        <div className="mt-2">
          <a href={url} className="text-blue-500">
            Read more
          </a>
        </div>
      </div>
      <hr className="my-4 dark:border-gray-600" />
      {/* Repository */}
      <div className="grid grid-cols-1 text-gray-600 dark:text-gray-400 sm:grid-cols-3">
        {/* Name/description */}
        <div className="col-span-1 flex flex-row items-center justify-center gap-2 sm:col-span-2 sm:justify-start">
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
          <div className="flex flex-row items-center justify-center gap-1 sm:justify-end">
            <StarIcon className="h-5 w-5 text-yellow-500" />
            {formatStarsNumber(repository.stars)}
          </div>
        )}
      </div>
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
  currentPledgeAmount,
}: {
  funding: Funding
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
      <div className="mt-2 flex items-center justify-center sm:mt-0 sm:justify-end">
        {[1, 2, 3].map(() => (
          <img
            src="https://placehold.co/50/darkgray/white?text=F"
            className="-ml-2 h-5 w-5 rounded-full border border-gray-50 dark:border-gray-950"
            alt="Pledger"
          />
        ))}
        <div className="-ml-2 flex h-5 w-5 items-center justify-center rounded-full border border-gray-50 bg-blue-600 text-[10px] text-blue-200 dark:border-gray-950">
          +4
        </div>
      </div>
    </div>
  )
}

export default IssueCard
