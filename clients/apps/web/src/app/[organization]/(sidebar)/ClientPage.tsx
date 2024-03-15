'use client'

import revalidate from '@/app/actions'
import { Post as PostComponent } from '@/components/Feed/Posts/Post'
import { FreeTierSubscribe } from '@/components/Organization/FreeTierSubscribe'
import { OrganizationIssueSummaryList } from '@/components/Organization/OrganizationIssueSummaryList'
import { CreatorsEditor } from '@/components/Profile/CreatorEditor/CreatorsEditor'
import {
  Link as LinkItem,
  LinksEditor,
} from '@/components/Profile/LinksEditor/LinksEditor'
import { ProjectsEditor } from '@/components/Profile/ProjectEditor/ProjectsEditor'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import SubscriptionTierSubscribeButton from '@/components/Subscriptions/SubscriptionTierSubscribeButton'
import { useTrafficRecordPageView } from '@/utils/traffic'
import {
  Article,
  IssueFunding,
  ListResourceSubscriptionSummary,
  ListResourceSubscriptionTier,
  Organization,
  OrganizationProfileSettingsUpdate,
  Repository,
} from '@polar-sh/sdk'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { useUpdateOrganization } from 'polarkit/hooks'
import { organizationPageLink } from 'polarkit/utils/nav'
import { useMemo } from 'react'

const ClientPage = ({
  organization,
  posts,
  subscriptionTiers,
  featuredOrganizations,
  repositories,
  subscriptionsSummary,
  adminOrganizations,
  issues,
  links,
}: {
  organization: Organization
  posts: Article[]
  subscriptionTiers: ListResourceSubscriptionTier
  featuredOrganizations: Organization[]
  repositories: Repository[]
  subscriptionsSummary: ListResourceSubscriptionSummary
  adminOrganizations: Organization[]
  issues: IssueFunding[]
  links: LinkItem[]
}) => {
  useTrafficRecordPageView({ organization })

  const isAdmin = useMemo(
    () => adminOrganizations?.some((org) => org.id === organization.id),
    [organization, adminOrganizations],
  )

  const shouldRenderSubscribeButton = !isAdmin

  const highlightedTiers = useMemo(
    () =>
      subscriptionTiers.items?.filter(
        ({ type, is_highlighted }) => is_highlighted,
      ) ?? [],
    [subscriptionTiers.items],
  )

  const shouldRenderSubscriberCount =
    (subscriptionsSummary.items?.length ?? 0) > 0

  const updateOrganizationMutation = useUpdateOrganization()

  const updateOrganization = (
    setting: Partial<OrganizationProfileSettingsUpdate>,
  ) => {
    return updateOrganizationMutation
      .mutateAsync({
        id: organization.id,
        settings: {
          profile_settings: setting,
        },
      })
      .then(() => revalidate(`organization:${organization.name}`))
  }

  const updateFeaturedCreators = (organizations: Organization[]) => {
    updateOrganization({
      featured_organizations: organizations.map((c) => c.id),
    })
  }

  const updateLinks = (links: LinkItem[]) => {
    updateOrganization({
      links: links.map((l) => l.url),
    })
  }

  return (
    <div className="flex w-full flex-col gap-y-24">
      <div className="flex flex-col gap-24 md:flex-row">
        <div className="flex w-full max-w-2xl flex-col gap-y-16">
          {(posts.length ?? 0) > 0 ? (
            <div className="flex w-full flex-col gap-y-6">
              <div className="flex flex-col gap-y-2 md:flex-row md:justify-between">
                <h2 className="text-lg">Pinned & Latest Posts</h2>
                <Link
                  className="text-sm text-blue-500 dark:text-blue-400"
                  href={organizationPageLink(organization, 'posts')}
                >
                  <span>View all</span>
                </Link>
              </div>
              <div className="flex flex-col gap-y-8">
                <div className="flex flex-col gap-6">
                  {posts.map((post) => (
                    <PostComponent
                      article={post}
                      key={post.id}
                      highlightPinned
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {repositories.length > 0 && (
            <ProjectsEditor
              organization={organization}
              repositories={repositories}
              featuredRepositories={
                organization.profile_settings.featured_projects ??
                repositories.slice(0, 2).map((repo) => repo.id)
              }
              disabled={!isAdmin}
            />
          )}

          <CreatorsEditor
            organization={organization}
            featuredOrganizations={featuredOrganizations}
            onChange={updateFeaturedCreators}
            disabled={!isAdmin}
          />

          {issues.length > 0 && (
            <OrganizationIssueSummaryList
              issues={issues}
              organization={organization}
            />
          )}
        </div>

        <div className="flex w-full flex-col gap-y-16">
          {highlightedTiers.length > 1 && (
            <div className="flex w-full flex-col gap-y-8">
              <div className="flex flex-col gap-y-4">
                <div className="flex flex-row items-center justify-between">
                  <h2>Subscriptions</h2>
                  <Link
                    className="text-sm text-blue-500 dark:text-blue-400"
                    href={organizationPageLink(organization, 'subscriptions')}
                  >
                    <span>View all</span>
                  </Link>
                </div>
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  Support {organization.name} with a subscription & receive
                  unique benefits in return
                </p>
                {shouldRenderSubscriberCount && (
                  <div className="flex flex-row items-center gap-x-6">
                    <div className="flex flex-row items-center">
                      {subscriptionsSummary.items?.map((subscriber, i) => (
                        <Avatar
                          className="-mr-3 h-8 w-8"
                          key={i}
                          name={subscriber.user.public_name ?? ''}
                          avatar_url={subscriber.user.avatar_url}
                          height={40}
                          width={40}
                        />
                      ))}
                    </div>
                    <span className="text-sm">
                      {Intl.NumberFormat('en-US', {
                        notation: 'compact',
                        compactDisplay: 'short',
                      }).format(
                        subscriptionsSummary.pagination.total_count,
                      )}{' '}
                      {subscriptionsSummary.pagination.total_count === 1
                        ? 'Subscriber'
                        : 'Subscribers'}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex w-full flex-col gap-4">
                {highlightedTiers.map((tier) => (
                  <SubscriptionTierCard
                    className="min-h-0 w-full"
                    key={tier.id}
                    subscriptionTier={tier}
                    variant="small"
                  >
                    {shouldRenderSubscribeButton ? (
                      <>
                        {tier.type === 'free' ? (
                          <FreeTierSubscribe
                            subscriptionTier={tier}
                            organization={organization}
                          />
                        ) : (
                          <SubscriptionTierSubscribeButton
                            organization={organization}
                            subscriptionTier={tier}
                            subscribePath="/api/subscribe"
                          />
                        )}
                      </>
                    ) : null}
                  </SubscriptionTierCard>
                ))}
              </div>
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
  )
}

export default ClientPage
