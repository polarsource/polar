'use client'

import revalidate from '@/app/actions'
import { FreeTierSubscribe } from '@/components/Organization/FreeTierSubscribe'
import IssuesLookingForFunding from '@/components/Organization/IssuesLookingForFunding'
import { CoverEditor } from '@/components/Profile/CoverEditor/CoverEditor'
import { CreatorsEditor } from '@/components/Profile/CreatorEditor/CreatorsEditor'
import { DescriptionEditor } from '@/components/Profile/DescriptionEditor/DescriptionEditor'
import {
  Link as LinkItem,
  LinksEditor,
} from '@/components/Profile/LinksEditor/LinksEditor'
import { SubscriptionTierEditor } from '@/components/Profile/SubscriptionTierEditor/SubscriptionTierEditor'
import useDebouncedCallback from '@/hooks/utils'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { ArrowUpRightIcon } from '@heroicons/react/20/solid'
import { ArrowForward } from '@mui/icons-material'
import {
  Article,
  ListResourceIssueFunding,
  Organization,
  Repository,
  RepositoryProfileSettingsUpdate,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { OgObject } from 'open-graph-scraper-lite/dist/lib/types'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { useUpdateProject } from 'polarkit/hooks'
import { formatStarsNumber } from 'polarkit/utils'
import { organizationPageLink } from 'polarkit/utils/nav'
import { useMemo, useState } from 'react'

const ClientPage = ({
  organization,
  repository,
  issuesFunding,
  featuredOrganizations,
  adminOrganizations,
  subscriptionTiers,
  links,
  posts,
}: {
  organization: Organization
  repository: Repository
  issuesFunding: ListResourceIssueFunding
  featuredOrganizations: Organization[]
  adminOrganizations: Organization[]
  subscriptionTiers: SubscriptionTier[]
  links: { opengraph: OgObject; url: string }[]
  posts: Article[]
}) => {
  const [descriptionIsLoading, setDescriptionIsLoading] = useState(false)
  const isAdmin = useMemo(
    () => adminOrganizations?.some((org) => org.id === organization.id),
    [organization, adminOrganizations],
  )

  useTrafficRecordPageView({ organization })

  const updateProjectMutation = useUpdateProject()

  const updateProfile = (setting: Partial<RepositoryProfileSettingsUpdate>) => {
    return updateProjectMutation
      .mutateAsync({
        id: repository.id,
        repositoryUpdate: {
          profile_settings: setting,
        },
      })
      .then(() =>
        revalidate(`repository:${organization.name}/${repository.name}`),
      )
  }

  const updateFeaturedCreators = (organizations: Organization[]) => {
    updateProfile({
      featured_organizations: organizations.map((c) => c.id),
    })
  }

  const updateCoverImage = (coverImageUrl: string | undefined) => {
    updateProfile({ set_cover_image_url: true, cover_image_url: coverImageUrl })
  }

  const updateDescription = useDebouncedCallback(
    async (description: string | undefined) => {
      setDescriptionIsLoading(true)
      try {
        await updateProfile({ set_description: true, description })
      } finally {
        setDescriptionIsLoading(false)
      }
    },
    500,
    [updateProfile, setDescriptionIsLoading],
  )

  const updateLinks = (links: LinkItem[]) => {
    updateProfile({ links: links.map((l) => l.url) })
  }

  const freeSubscriptionTier = subscriptionTiers.find(
    (tier) => tier.type === SubscriptionTierType.FREE,
  )

  return (
    <div className="flex w-full flex-col gap-y-12">
      <div className="flex w-full flex-col gap-16">
        <div className="flex flex-col gap-16 md:flex-row">
          <div className="flex w-full min-w-0 flex-shrink flex-col gap-y-16">
            {repository.description && (
              <DescriptionEditor
                description={
                  repository.profile_settings.description ??
                  repository.description ??
                  ''
                }
                onChange={updateDescription}
                disabled={!isAdmin}
                loading={descriptionIsLoading}
              />
            )}
            <CoverEditor
              organization={organization}
              onChange={updateCoverImage}
              coverImageUrl={repository.profile_settings.cover_image_url}
              disabled={!isAdmin}
            />

            <SubscriptionTierEditor
              organization={organization}
              repository={repository}
              subscriptionTiers={subscriptionTiers}
              disabled={!isAdmin}
            />

            <CreatorsEditor
              organization={organization}
              featuredOrganizations={featuredOrganizations}
              onChange={updateFeaturedCreators}
              disabled={!isAdmin}
            />

            {(issuesFunding.items?.length ?? 0) > 0 && (
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
                      {repository.organization.pretty_name}
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

              {freeSubscriptionTier && !isAdmin ? (
                <>
                  <FreeTierSubscribe
                    subscriptionTier={freeSubscriptionTier}
                    organization={organization}
                    upsellSubscriptions
                  />
                </>
              ) : null}
            </div>

            {posts.length > 0 && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-row items-center gap-4">
                  <h3>Posts from the creator</h3>
                </div>
                <ShadowBoxOnMd className="flex w-full flex-col gap-6 md:p-6">
                  {posts.map((post) => (
                    <Link
                      key={post.id}
                      href={organizationPageLink(
                        organization,
                        `posts/${post.slug}`,
                      )}
                      className="flex w-full flex-col gap-1 transition-opacity hover:opacity-70"
                    >
                      <h3 className="line-clamp-2">{post.title}</h3>
                      <span className="dark:text-polar-500 text-sm text-gray-500">
                        {new Date(post.published_at ?? 0).toLocaleDateString(
                          'en-US',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          },
                        )}
                      </span>
                    </Link>
                  ))}
                  <Link
                    className="flex flex-row items-center gap-2 text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                    href={organizationPageLink(organization, 'posts')}
                  >
                    <span>View all</span>
                    <ArrowForward fontSize="inherit" />
                  </Link>
                </ShadowBoxOnMd>
              </div>
            )}

            <LinksEditor
              organization={organization}
              links={links}
              onChange={updateLinks}
              disabled={!isAdmin}
              variant="column"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClientPage
