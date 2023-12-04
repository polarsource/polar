import {
  BusinessOutlined,
  EmailOutlined,
  LanguageOutlined,
  ShortTextOutlined,
} from '@mui/icons-material'
import { Organization, SubscriptionSummary } from '@polar-sh/sdk'
import Link from 'next/link'
import { Avatar } from 'polarkit/components/ui/atoms'
import { useMemo } from 'react'
import { externalURL, prettyURL } from '.'

function parseGitHubUsernameLinks(text: string) {
  const words = text.split(' ')

  const parsedWords = words.map((word) => {
    if (word.startsWith('@')) {
      const username = word.slice(1).replace(/\./g, '')
      const link = `https://github.com/${username}`

      return (
        <a
          className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
          href={link}
          rel="noopener noreferrer"
          target="_blank"
        >
          {word}
        </a>
      )
    } else {
      return word
    }
  })

  return (
    <p>
      {parsedWords.reduce<(string | JSX.Element)[]>((prev, curr, index) => {
        return index === 0 ? [curr] : [...prev, ' ', curr]
      }, [])}
    </p>
  )
}

interface OrganizationPublicSidebarProps {
  organization: Organization
  subscriptionSummary: SubscriptionSummary[]
  subscribersCount: number
}

export const OrganizationPublicSidebar = ({
  organization,
  subscriptionSummary,
  subscribersCount,
}: OrganizationPublicSidebarProps) => {
  const showMeta =
    organization.bio ||
    organization.company ||
    organization.email ||
    organization.twitter_username

  const subscriberUsers = useMemo(
    () => subscriptionSummary.slice(0, 9).map((summary) => summary.user),
    [subscriptionSummary],
  )

  const subscribersHiddenCount = useMemo(
    () => subscriptionSummary.slice(9).length,
    [subscriptionSummary],
  )

  return (
    <div className="flex h-full w-full shrink-0 flex-col gap-y-10 md:sticky md:top-16 md:w-64">
      <div className="flex flex-col items-center gap-y-6 md:items-start">
        <div className="flex flex-col items-center gap-y-2 md:items-start">
          <Avatar
            className="mb-6 h-32 w-32 md:h-60 md:w-60"
            name={organization.name}
            avatar_url={organization.avatar_url}
          />
          <h1 className="dark:text-polar-50 text-2xl font-normal capitalize text-gray-800">
            {organization.pretty_name ?? organization.name}
          </h1>
          <h3 className="text-md font-normal text-blue-500 dark:text-blue-400">
            @{organization.name}
          </h3>
        </div>
        {organization.bio && (
          <p className="dark:text-polar-500 text-center text-sm leading-relaxed text-gray-500 md:text-start">
            {parseGitHubUsernameLinks(organization.bio)}
          </p>
        )}
        {showMeta && (
          <div className="dark:text-polar-500 flex flex-col gap-y-2 text-sm">
            {organization.company && (
              <div className="flex flex-row items-center gap-x-3">
                <span className="text-[17px]">
                  <BusinessOutlined fontSize="inherit" />
                </span>
                <span>{organization.company}</span>
              </div>
            )}
            {organization.blog && (
              <div className="flex flex-row items-center gap-x-3">
                <span className="text-[17px]">
                  <LanguageOutlined fontSize="inherit" />
                </span>
                <a
                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  href={externalURL(organization.blog)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {prettyURL(organization.blog)}
                </a>
              </div>
            )}

            {organization.email && (
              <div className="flex flex-row items-center gap-x-3">
                <span className="text-[17px]">
                  <EmailOutlined fontSize="inherit" />
                </span>
                <a
                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  href={`mailto:${organization.email}`}
                  rel="noopener noreferrer"
                >
                  {organization.email}
                </a>
              </div>
            )}

            {organization.twitter_username && (
              <div className="flex flex-row items-center gap-x-3">
                <span className="text-[17px]">
                  <ShortTextOutlined fontSize="inherit" />
                </span>
                <a
                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  href={`https://twitter.com/${organization.twitter_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{organization.twitter_username}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
      {subscriberUsers.length > 0 && (
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-start justify-between">
            <h3>Subscribers</h3>
            <h3>{subscribersCount}</h3>
          </div>
          <div className="flex flex-row flex-wrap gap-3">
            {subscriberUsers.map((user) => (
              <Link
                href={`https://github.com/${user.username}`}
                target="_blank"
              >
                <Avatar
                  key={user.username}
                  className="h-10 w-10"
                  name={user.username}
                  avatar_url={user.avatar_url}
                />
              </Link>
            ))}
            {subscribersHiddenCount > 0 && (
              <div className="dark:border-polar-600 dark:text-polar-500 flex h-10 w-10 flex-col items-center justify-center rounded-full border border-blue-200 text-xs font-medium text-blue-400">
                {subscribersHiddenCount}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
