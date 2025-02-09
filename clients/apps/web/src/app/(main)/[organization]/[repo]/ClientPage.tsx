'use client'

import IssuesLookingForFunding from '@/components/Organization/IssuesLookingForFunding'
import { organizationPageLink } from '@/utils/nav'
import { formatStarsNumber } from '@/utils/stars'
import { ArrowUpRightIcon } from '@heroicons/react/20/solid'
import { components } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import type { SuccessResult } from 'open-graph-scraper-lite'

type OgObject = SuccessResult['result']

const ClientPage = ({
  organization,
  repository,
  issuesFunding,
}: {
  organization: components['schemas']['Organization']
  repository: components['schemas']['Repository']
  issuesFunding: components['schemas']['ListResource_IssueFunding_']
  featuredOrganizations: components['schemas']['Organization'][]
  userOrganizations: components['schemas']['Organization'][]
  links: { opengraph: OgObject; url: string }[]
}) => {
  return (
    <div className="flex w-full flex-col gap-y-12">
      <div className="flex w-full flex-col gap-16">
        <div className="flex flex-col gap-16 md:flex-row">
          <div className="flex w-full min-w-0 flex-shrink flex-col gap-y-16">
            {organization.feature_settings?.issue_funding_enabled &&
              (issuesFunding.items.length ?? 0) > 0 && (
                <ShadowBoxOnMd>
                  <div className="p-4">
                    <div className="flex flex-row items-start justify-between pb-8">
                      <h2 className="text-lg font-medium">
                        Issues looking for funding
                      </h2>
                    </div>
                    <IssuesLookingForFunding
                      organization={organization}
                      repository={repository}
                      issues={issuesFunding}
                    />
                  </div>
                </ShadowBoxOnMd>
              )}
          </div>

          <div className="flex w-full flex-col gap-12 md:max-w-52 lg:max-w-72">
            <div className="flex flex-col gap-6">
              <ShadowBoxOnMd className="flex flex-col gap-6 md:p-6">
                <div className="flex flex-col gap-4">
                  <Avatar
                    className="h-12 w-12"
                    avatar_url={organization.avatar_url}
                    name={organization.name}
                  />
                  <span className="flex flex-row flex-wrap gap-2">
                    <Link
                      className="dark:text-polar-500 text-wrap text-gray-500 transition-colors hover:text-blue-500 dark:hover:text-blue-400"
                      href={organizationPageLink(organization)}
                    >
                      {repository.organization.name}
                    </Link>
                    <span className="dark:text-polar-600 text-gray-400">/</span>
                    <Link
                      className="text-wrap transition-colors hover:text-blue-500 dark:hover:text-blue-400"
                      href={organizationPageLink(organization, repository.name)}
                    >
                      {repository.name}
                    </Link>
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 text-sm">
                  <div className="flex flex-row justify-between gap-x-4">
                    <span className="dark:text-polar-400 text-gray-600">
                      Creator
                    </span>
                    <Link
                      className="truncate text-right"
                      href={organizationPageLink(organization)}
                    >
                      {repository.organization.name}
                    </Link>
                  </div>
                  <div className="flex flex-row justify-between gap-x-4">
                    <span className="dark:text-polar-400 text-gray-600">
                      Stars
                    </span>
                    <span className="truncate text-right">
                      {formatStarsNumber(repository.stars ?? 0)}
                    </span>
                  </div>
                  <div className="flex flex-row justify-between gap-x-4">
                    <span className="dark:text-polar-400 text-gray-600">
                      License
                    </span>
                    <span className="truncate text-right">
                      {repository.license ?? 'Unlicensed'}
                    </span>
                  </div>
                  <div className="flex flex-row justify-between gap-x-4">
                    <span className="dark:text-polar-400 text-gray-600">
                      Repository
                    </span>
                    <Link
                      className="flex flex-row items-center gap-x-2 truncate text-right"
                      href={`https://github.com/${repository.organization.name}/${repository.name}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {'GitHub'}
                      <ArrowUpRightIcon className="h-4 w-4" />
                    </Link>
                  </div>
                  {repository.homepage && (
                    <div className="flex flex-row justify-between gap-x-4">
                      <span className="dark:text-polar-400 text-gray-600">
                        Website
                      </span>
                      <Link
                        className="flex flex-row items-center gap-x-2 truncate text-right"
                        href={repository.homepage}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {new URL(repository.homepage).hostname}
                        <ArrowUpRightIcon className="h-4 w-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </ShadowBoxOnMd>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClientPage
