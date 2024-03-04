'use client'

import IssuesLookingForFunding from '@/components/Organization/IssuesLookingForFunding'
import { organizationPageLink } from '@/utils/nav'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { ArrowUpRightIcon } from '@heroicons/react/20/solid'
import {
  ListResourceArticle,
  ListResourceIssueFunding,
  Organization,
  Repository,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { Separator } from 'polarkit/components/ui/separator'

const ClientPage = ({
  organization,
  repository,
  issuesFunding,
}: {
  organization: Organization
  repository: Repository
  issuesFunding: ListResourceIssueFunding
  articles: ListResourceArticle
  pinnedArticles: ListResourceArticle
}) => {
  useTrafficRecordPageView({ organization })

  return (
    <div className="flex w-full flex-col gap-y-12">
      <div className="flex w-full max-w-5xl flex-col gap-y-16">
        <div className="flex w-full flex-col gap-y-16">
          {repository.description && (
            <>
              <p className="dark:text-polar-50 text-3xl !font-normal leading-normal text-gray-950">
                {repository.description}
              </p>
              <Separator className="h-0.5 w-12 bg-black dark:bg-white" />
            </>
          )}
          <div className="grid grid-cols-2 flex-row gap-12 md:flex md:gap-24">
            <div className="flex flex-col gap-y-1">
              <span className="dark:text-polar-400 text-gray-600">Creator</span>
              <Link href={organizationPageLink(organization)}>
                {repository.organization.pretty_name}
              </Link>
            </div>
            <div className="flex flex-col gap-y-1">
              <span className="dark:text-polar-400 text-gray-600">Stars</span>
              <span>
                {Intl.NumberFormat('en-US', {
                  notation: 'compact',
                  compactDisplay: 'short',
                }).format(repository.stars ?? 0)}
              </span>
            </div>
            <div className="flex flex-col gap-y-1">
              <span className="dark:text-polar-400 text-gray-600">License</span>
              <span>{repository.license ?? 'Unlicensed'}</span>
            </div>
            <div className="flex flex-col gap-y-1">
              <span className="dark:text-polar-400 text-gray-600">
                Repository
              </span>
              <Link
                className="flex flex-row items-center gap-x-2"
                href={`https://github.com/${repository.organization.name}/${repository.name}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {'GitHub'}
                <ArrowUpRightIcon className="h-5 w-5" />
              </Link>
            </div>
            {repository.homepage && (
              <div className="flex flex-col gap-y-1">
                <span className="dark:text-polar-400 text-gray-600">
                  Website
                </span>
                <Link
                  className="flex flex-row items-center gap-x-2"
                  href={repository.homepage}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {new URL(repository.homepage).hostname}
                  <ArrowUpRightIcon className="h-5 w-5" />
                </Link>
              </div>
            )}
          </div>
        </div>

        <ShadowBoxOnMd>
          <div className="p-4">
            <IssuesLookingForFunding
              organization={organization}
              repository={repository}
              issues={issuesFunding}
            />
          </div>
        </ShadowBoxOnMd>
      </div>
    </div>
  )
}

export default ClientPage
