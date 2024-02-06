'use client'

import {
  BusinessOutlined,
  EmailOutlined,
  LanguageOutlined,
  ShortTextOutlined,
} from '@mui/icons-material'
import { Organization, SubscriptionTierType } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar, Button } from 'polarkit/components/ui/atoms'
import { useListAdminOrganizations, useSubscriptionTiers } from 'polarkit/hooks'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { externalURL, prettyURL } from '.'
import GitHubIcon from '../Icons/GitHubIcon'
import { FreeTierSubscribe } from './FreeTierSubscribe'

interface OrganizationPublicSidebarProps {
  organization: Organization
}

export const OrganizationPublicSidebar = ({
  organization,
}: OrganizationPublicSidebarProps) => {
  const pathname = usePathname()
  const { data: { items: subscriptionTiers } = { items: [] } } =
    useSubscriptionTiers(organization.name, 100)

  const freeSubscriptionTier = useMemo(
    () =>
      subscriptionTiers?.find(
        (tier) => tier.type === SubscriptionTierType.FREE,
      ),
    [subscriptionTiers],
  )

  const adminOrgs = useListAdminOrganizations()
  const shouldRenderDashboardButton = useMemo(
    () =>
      adminOrgs?.data?.items?.some((org) => org.name === organization?.name),
    [adminOrgs, organization],
  )

  const isPostView = useMemo(() => pathname.includes('posts'), [pathname])

  return (
    <div className="flex h-fit w-full shrink-0 flex-col gap-y-10 md:sticky md:top-32 md:w-64">
      <>
        <div className="flex flex-col items-start gap-y-6">
          <div className="flex w-full flex-row items-start gap-x-2 gap-y-2 md:flex-col md:gap-x-0">
            <Avatar
              className="h-12 w-12 md:mb-6 md:h-60 md:w-60"
              name={organization.name}
              avatar_url={organization.avatar_url}
              height={240}
              width={240}
            />
            <div className="flex flex-col items-start md:gap-y-2">
              <h1 className="dark:text-polar-50 text-xl font-normal capitalize text-gray-800 md:text-2xl">
                {organization.pretty_name ?? organization.name}
              </h1>
              <Link
                href={`/${organization.name}`}
                className="text-md font-normal text-blue-500 dark:text-blue-400"
              >
                @{organization.name}
              </Link>
            </div>
          </div>
          {organization.bio && (
            <p className="dark:text-polar-500 text-start text-sm leading-relaxed text-gray-500">
              {organization.bio}
            </p>
          )}
          {shouldRenderDashboardButton ? (
            <Link
              className="w-full"
              href={`/maintainer/${organization.name}/overview`}
            >
              <Button fullWidth>View Dashboard</Button>
            </Link>
          ) : freeSubscriptionTier ? (
            <FreeTierSubscribe
              subscriptionTier={freeSubscriptionTier}
              organization={organization}
            />
          ) : null}
          <div
            className={twMerge(
              'dark:text-polar-500 flex flex-col gap-y-2 text-sm',
              isPostView && 'hidden md:flex',
            )}
          >
            {organization.company && (
              <div className="flex flex-row items-center gap-x-3">
                <span className="text-[17px]">
                  <BusinessOutlined fontSize="inherit" />
                </span>
                <span>{organization.company}</span>
              </div>
            )}
            <div className="flex flex-row items-center gap-x-3">
              <span className="text-[17px]">
                <GitHubIcon width={16} height={16} />
              </span>
              <a
                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                href={`https://github.com/${organization.name}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {organization.name}
              </a>
            </div>
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
                  {organization.twitter_username}
                </a>
              </div>
            )}
          </div>
        </div>
      </>
    </div>
  )
}
