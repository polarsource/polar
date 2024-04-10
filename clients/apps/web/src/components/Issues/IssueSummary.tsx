'use client'

import { organizationPageLink } from '@/utils/nav'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { Issue, IssueStateEnum, Label } from '@polar-sh/sdk'
import { PolarTimeAgo } from 'polarkit/components/ui/atoms'
import { twMerge } from 'tailwind-merge'
import IconCounter from './IconCounter'
import IssueLabel from './IssueLabel'
import { generateMarkdownTitle } from './markdown'

interface IssueSummaryProps {
  issue: Issue
  showLogo?: boolean
  showStatus?: boolean
  right?: React.ReactElement
}

const IssueSummary: React.FC<IssueSummaryProps> = ({
  issue,
  showLogo,
  showStatus,
  right,
}) => {
  const {
    title,
    number,
    state,
    issue_created_at,
    issue_closed_at,
    reactions,
    comments,
    repository,
  } = issue
  const { organization } = repository
  const isOpen = state === IssueStateEnum.OPEN

  const createdAt = new Date(issue_created_at)
  const closedAt = issue_closed_at ? new Date(issue_closed_at) : undefined

  const showCommentsCount = !!(comments && comments > 0)

  const positiveReactions = reactions
    ? reactions.plus_one +
      reactions.heart +
      reactions.hooray +
      reactions.laugh +
      reactions.rocket
    : 0
  const showReactionsThumbs = positiveReactions > 0

  const markdownTitle = generateMarkdownTitle(title)

  return (
    <div className="dark:md:hover:bg-polar-800 duration-50 dark:text-polar-50 md:hover:bg-gray-75 group flex flex-col items-start justify-between gap-4 overflow-hidden px-6 py-4 pb-5 md:flex-row md:items-center md:rounded-2xl">
      <div className="flex flex-row items-center">
        {showLogo && (
          <div className="mr-4 flex-shrink-0 justify-center rounded-full bg-white p-[1px] shadow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`Avatar of ${organization.name}`}
              src={organization.avatar_url}
              className="h-8 w-8 rounded-full"
              height={200}
              width={200}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <a
              className="text-md dark:text-polar-50 text-nowrap font-medium"
              href={organizationPageLink(
                organization,
                `${repository.name}/issues/${number}`,
              )}
            >
              {markdownTitle}
            </a>

            {issue.labels &&
              issue.labels.map((label: Label) => {
                return <IssueLabel label={label} key={label.name} />
              })}
          </div>
          <div className="dark:text-polar-400 text-xs text-gray-500">
            <p>
              #{number}{' '}
              {isOpen ? (
                <>
                  opened <PolarTimeAgo date={createdAt} />
                </>
              ) : (
                <>
                  closed <PolarTimeAgo date={closedAt as Date} />
                </>
              )}{' '}
              in {organization.name}/{repository.name}
            </p>
          </div>
        </div>
      </div>
      <div
        className={twMerge(
          'flex flex-col items-center gap-6 md:flex-row',
          showLogo && 'md:pl-none pl-12',
        )}
      >
        <div className="flex items-center gap-4">
          {showStatus && (
            <div className="dark:text-polar-400 flex flex-row items-center gap-2 text-sm text-gray-500">
              {isOpen ? (
                <>
                  <div className="dark:border-polar-500 h-4 w-4 rounded-full border border-gray-500"></div>
                  <span>Open</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>Closed</span>
                </>
              )}
            </div>
          )}

          {showCommentsCount && (
            <IconCounter icon="comments" count={comments} />
          )}
          {showReactionsThumbs && reactions && (
            <IconCounter icon="thumbs_up" count={positiveReactions} />
          )}
        </div>

        {right}
      </div>
    </div>
  )
}

export default IssueSummary
