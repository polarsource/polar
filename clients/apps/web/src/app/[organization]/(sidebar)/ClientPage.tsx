'use client'

import revalidate from '@/app/actions'
import { Post as PostComponent } from '@/components/Feed/Posts/Post'
import { PublicPagePostWizard } from '@/components/Onboarding/Creator/PostWizard'
import { OrganizationHighlightedTiers } from '@/components/Organization/OrganizationHighlightedTiers'
import { OrganizationIssueSummaryList } from '@/components/Organization/OrganizationIssueSummaryList'
import { CreatorsEditor } from '@/components/Profile/CreatorEditor/CreatorsEditor'
import {
  Link as LinkItem,
  LinksEditor,
} from '@/components/Profile/LinksEditor/LinksEditor'
import { ProjectsEditor } from '@/components/Profile/ProjectEditor/ProjectsEditor'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { ViewDayOutlined } from '@mui/icons-material'
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
      <div className="flex flex-col gap-24 lg:flex-row lg:gap-16">
        <div className="flex w-full min-w-0 flex-shrink flex-col gap-y-16 md:max-w-xl xl:max-w-3xl">
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
            {(posts.length ?? 0) > 0 ? (
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
            ) : isAdmin ? (
              <PublicPagePostWizard organization={organization} />
            ) : (
              <div className="dark:text-polar-400 flex h-full w-full flex-col items-center gap-y-4 pt-16 text-gray-600">
                <ViewDayOutlined fontSize="large" />
                <div className="flex w-full flex-col items-center gap-y-2 px-12 text-center">
                  <h3 className="p-2 text-lg font-medium">
                    {organization.name} is typing...
                  </h3>
                  <p className="dark:text-polar-500 w-full min-w-0 text-gray-500">
                    Subscribe to {organization.name} to get future posts fresh
                    out of the press.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex w-full flex-col lg:hidden">
            <OrganizationHighlightedTiers
              organization={organization}
              adminOrganizations={adminOrganizations}
              subscriptionTiers={subscriptionTiers.items ?? []}
            />
          </div>

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

          <div className="flex w-full flex-col lg:hidden">
            <LinksEditor
              organization={organization}
              links={links}
              onChange={updateLinks}
              disabled={!isAdmin}
              variant="column"
            />
          </div>

          {issues.length > 0 && (
            <OrganizationIssueSummaryList
              issues={issues}
              organization={organization}
            />
          )}
        </div>

        <div className="hidden w-full flex-col gap-y-16 md:max-w-52 lg:flex lg:max-w-72">
          <OrganizationHighlightedTiers
            organization={organization}
            adminOrganizations={adminOrganizations}
            subscriptionTiers={subscriptionTiers.items ?? []}
          />

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
