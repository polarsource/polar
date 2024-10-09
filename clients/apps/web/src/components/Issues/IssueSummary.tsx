'use client'

import { CONFIG } from '@/utils/config'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { FavoriteBorderOutlined } from '@mui/icons-material'
import { Issue, Label, State } from '@polar-sh/sdk'
import Link from 'next/link'
import { PolarTimeAgo } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { twMerge } from 'tailwind-merge'
import IconCounter from './IconCounter'
import IssueLabel from './IssueLabel'
import { generateMarkdownTitle } from './markdown'

interface IssueSummaryProps {
  issue: Issue
  showLogo?: boolean
  showStatus?: boolean
  right?: React.ReactElement
  linkToFunding?: boolean
}

const IssueSummary: React.FC<IssueSummaryProps> = ({
  issue,
  showLogo,
  showStatus,
  right,
  linkToFunding,
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
  const isOpen = state === State.OPEN

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

  const fundingLink = `${CONFIG.FRONTEND_BASE_URL}/${organization.name}/${repository.name}/issues/${number}`
  linkToFunding = linkToFunding !== undefined ? linkToFunding : true

  return (
    <div className="dark:md:hover:bg-polar-800 duration-50 group flex flex-col items-start justify-between gap-4 overflow-hidden px-6 py-4 pb-5 md:flex-row md:items-center md:rounded-2xl md:hover:bg-gray-50 dark:text-white">
      <div className="flex flex-row items-center">
        {showLogo && (
          <div className="mr-4 flex-shrink-0 justify-center rounded-full bg-gray-50 p-[1px] shadow">
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
            {linkToFunding ? (
              <Link
                className="text-md min-w-0 max-w-96 flex-1 truncate text-nowrap font-medium dark:text-white"
                href={fundingLink}
              >
                {markdownTitle}
              </Link>
            ) : (
              <span className="text-md min-w-0 max-w-96 flex-1 truncate text-nowrap font-medium dark:text-white">
                {markdownTitle}
              </span>
            )}

            {issue.labels &&
              issue.labels.map((label: Label) => {
                return <IssueLabel label={label} key={label.name} />
              })}
          </div>
          <div className="dark:text-polar-400 text-xs text-gray-500">
            <p>
              <a
                href={`https://github.com/${organization.name}/${repository.name}/issues/${number}`}
                className="text-gray-700"
                rel="nofollow"
              >
                #{number}
              </a>{' '}
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

        <Link href={fundingLink} className="font-medium text-blue-500">
          <Button size="sm" variant="secondary" asChild>
            <FavoriteBorderOutlined fontSize="inherit" />
            <span className="ml-1.5">Fund</span>
          </Button>
        </Link>
        {right}
      </div>
    </div>
  )
}

export default IssueSummary
