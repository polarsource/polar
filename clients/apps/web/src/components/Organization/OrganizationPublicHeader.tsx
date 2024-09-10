'use client'

import { useExternalOrganizations } from '@/hooks/queries/externalOrganizations'
import { LanguageOutlined, MailOutline } from '@mui/icons-material'
import {
  ListResourceOrganizationCustomer,
  Organization,
  Platforms,
  Product,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import { externalURL } from '.'
import { DonateWidget } from '../Donations/DontateWidget'
import GitHubIcon from '../Icons/GitHubIcon'
import { SubscribeEditor } from '../Profile/SubscribeEditor/SubscribeEditor'

interface OrganizationPublicSidebarProps {
  organization: Organization
  organizationCustomers: ListResourceOrganizationCustomer | undefined
  userOrganizations: Organization[]
  products: Product[]
}

export const OrganizationPublicHeader = ({
  organization,
  organizationCustomers,
  userOrganizations,
  products,
}: OrganizationPublicSidebarProps) => {
  const segment = useSelectedLayoutSegment()

  const isOrgMember = userOrganizations.some((o) => o.id === organization.id)

  const externalGitHubOrganizations = useExternalOrganizations({
    organizationId: organization.id,
    platform: Platforms.GITHUB,
    limit: 1,
    sorting: ['created_at'],
  })

  const isPostView = segment === 'posts'
  const isDonatePage = segment === 'donate'

  return (
    <div className="flex w-full flex-grow flex-col items-center gap-y-6">
      <div className="rounded-4xl dark:bg-polar-900 h-64 w-full bg-blue-50" />
      <div className="flex flex-grow flex-col items-center">
        <Avatar
          className="h-16 w-16 text-lg md:mb-6 md:h-32 md:w-32 md:text-5xl"
          name={organization.name}
          avatar_url={organization.avatar_url}
        />
        <div className="flex flex-col items-center md:gap-y-1">
          <h1 className="text-xl md:text-2xl">{organization.name}</h1>
          <Link
            className="dark:text-polar-500 text-gray-500 md:text-lg"
            href={`/${organization.slug}`}
          >
            @{organization.slug}
          </Link>
        </div>
      </div>
      <div
        className={twMerge(
          'flex flex-grow flex-col items-center',
          isPostView ? 'hidden  md:flex' : 'flex',
        )}
      >
        <div className="flex flex-grow flex-col items-center gap-y-6">
          <p
            className={twMerge(
              'dark:text-polar-500 text-pretty break-words text-center leading-normal text-gray-500',
            )}
          >
            {organization.profile_settings?.description ??
              organization.bio ??
              ''}
          </p>

          <div className="flex flex-row flex-wrap items-center gap-3 text-lg">
            {externalGitHubOrganizations.data?.items.map(
              (externalOrganization) => (
                <SocialLink
                  key={externalOrganization.id}
                  href={`https://github.com/${externalOrganization.name}`}
                >
                  <GitHubIcon width={20} height={20} />
                </SocialLink>
              ),
            )}
            {organization.twitter_username && (
              <SocialLink
                href={`https://twitter.com/${organization.twitter_username}`}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 300 300.251"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.93L0 300.25h26.46l102.4-116.59 81.8 116.59h89.34M36.01 19.54H76.66l187.13 262.13h-40.66"
                    fill="currentColor"
                  />
                </svg>
              </SocialLink>
            )}
            {organization.blog && (
              <SocialLink href={externalURL(organization.blog)}>
                <LanguageOutlined fontSize="small" />
              </SocialLink>
            )}
            {organization.email && (
              <SocialLink href={`mailto:${organization.email}`}>
                <MailOutline fontSize="small" />
              </SocialLink>
            )}
          </div>
        </div>
        <SubscribeEditor
          organization={organization}
          customerList={organizationCustomers}
          products={products}
          isOrgMember={isOrgMember}
        />

        {organization.donations_enabled && !isDonatePage ? (
          <DonateWidget organization={organization} />
        ) : null}
      </div>
    </div>
  )
}

const SocialLink = (props: PropsWithChildren<{ href: string }>) => {
  return (
    <Link
      target="_blank"
      rel="noopener nofollow"
      className="dark:text-polar-400 flex flex-col items-center justify-center rounded-full bg-transparent text-gray-500 transition-colors hover:bg-transparent hover:text-blue-500 dark:bg-transparent dark:hover:text-white"
      href={props.href}
    >
      {props.children}
    </Link>
  )
}
