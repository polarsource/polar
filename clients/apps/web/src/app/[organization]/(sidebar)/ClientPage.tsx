'use client'

import { Post as PostComponent } from '@/components/Feed/Posts/Post'
import { OrganizationIssueSummaryList } from '@/components/Organization/OrganizationIssueSummaryList'
import { CreatorsEditor } from '@/components/Profile/CreatorEditor/CreatorsEditor'
import { HighlightedTiersEditor } from '@/components/Profile/HighlightedTiersEditor/HighlightedTiersEditor'
import {
  Link as LinkItem,
  LinksEditor,
} from '@/components/Profile/LinksEditor/LinksEditor'
import { ProjectsEditor } from '@/components/Profile/ProjectEditor/ProjectsEditor'
import { useUpdateOrganization } from '@/hooks/queries'
import { organizationPageLink } from '@/utils/nav'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { DraftsOutlined } from '@mui/icons-material'
import {
  Article,
  IssueFunding,
  Organization,
  OrganizationProfileSettings,
  Product,
  PublicDonation,
  Repository,
} from '@polar-sh/sdk'
import { formatCurrencyAndAmount } from '@polarkit/lib/money'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const ClientPage = ({
  organization,
  posts,
  products,
  featuredOrganizations,
  repositories,
  featuredProjects,
  userOrganizations,
  issues,
  links,
  donations,
}: {
  organization: Organization
  posts: Article[]
  products: Product[]
  featuredOrganizations: Organization[]
  repositories: Repository[]
  featuredProjects: Repository[]
  userOrganizations: Organization[]
  issues: IssueFunding[]
  links: LinkItem[]
  donations: PublicDonation[]
}) => {
  useTrafficRecordPageView({ organization })

  const isOrgMember = useMemo(
    () => userOrganizations?.some((org) => org.id === organization.id),
    [organization, userOrganizations],
  )

  const updateOrganizationMutation = useUpdateOrganization()

  const updateOrganization = (
    setting: Partial<OrganizationProfileSettings>,
  ) => {
    return updateOrganizationMutation.mutateAsync({
      id: organization.id,
      body: {
        profile_settings: setting,
      },
    })
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

  const PostsEmptyState = () => {
    return isOrgMember ? (
      <div className="dark:text-polar-500 flex flex-col items-center gap-y-4 pt-16 text-gray-600">
        <DraftsOutlined fontSize="large" />
        <p className="text-center">
          Build out an audience by writing posts and share it with your
          subscribers
        </p>
      </div>
    ) : (
      <div className="dark:text-polar-400 flex h-full w-full flex-col items-center gap-y-4 pt-16 text-gray-600">
        <DraftsOutlined fontSize="large" />
        <div className="flex w-full flex-col items-center gap-y-2 px-12 text-center">
          <h3 className="p-2 text-lg font-medium">
            {organization.name} is typing...
          </h3>
          <p className="dark:text-polar-500 w-full min-w-0 text-gray-500">
            Subscribe to {organization.name} to get future posts fresh out of
            the press.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-y-24">
      <div className="flex flex-col gap-24 lg:flex-row lg:gap-16">
        <div className="flex w-full min-w-0 flex-shrink flex-col gap-y-16 md:max-w-xl xl:max-w-3xl">
          {organization.feature_settings?.articles_enabled && (
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
              ) : (
                <PostsEmptyState />
              )}
            </div>
          )}

          {organization.feature_settings?.subscriptions_enabled && (
            <div className="flex w-full flex-col lg:hidden">
              <HighlightedTiersEditor
                organization={organization}
                userOrganizations={userOrganizations}
                products={products}
              />
            </div>
          )}

          {repositories.length > 0 ? (
            <ProjectsEditor
              organization={organization}
              repositories={repositories}
              featuredRepositories={featuredProjects}
              disabled={!isOrgMember}
            />
          ) : null}

          <CreatorsEditor
            organization={organization}
            featuredOrganizations={featuredOrganizations}
            onChange={updateFeaturedCreators}
            disabled={!isOrgMember}
          />

          {organization.donations_enabled && (
            <div className="flex w-full flex-col lg:hidden">
              <DonationsFeed donations={donations} />
            </div>
          )}

          <div className="flex w-full flex-col lg:hidden">
            <LinksEditor
              links={links}
              onChange={updateLinks}
              disabled={!isOrgMember}
              variant="column"
            />
          </div>

          {organization.feature_settings?.issue_funding_enabled &&
          issues.length > 0 ? (
            <OrganizationIssueSummaryList
              issues={issues}
              organization={organization}
            />
          ) : null}
        </div>

        <div className="hidden w-full flex-col gap-y-16 md:max-w-52 lg:flex lg:max-w-72">
          {organization.feature_settings?.subscriptions_enabled && (
            <HighlightedTiersEditor
              organization={organization}
              userOrganizations={userOrganizations}
              products={products}
            />
          )}

          {organization.donations_enabled && (
            <DonationsFeed donations={donations} />
          )}

          <LinksEditor
            links={links}
            onChange={updateLinks}
            disabled={!isOrgMember}
            variant="column"
          />
        </div>
      </div>
    </div>
  )
}

export default ClientPage

interface DonationsFeedProps {
  donations: PublicDonation[]
}

const DonationsFeed = ({ donations }: DonationsFeedProps) => {
  const getDonorName = (donation: PublicDonation) => {
    if (donation.donor) {
      return 'public_name' in donation.donor
        ? donation.donor.public_name
        : donation.donor.name
    } else {
      return 'An anonymous donor'
    }
  }

  if (donations.length < 1) {
    return null
  }

  return (
    <div className="flex w-full flex-col gap-y-8 md:gap-y-4">
      <div>
        <h3 className="text-lg">Donations</h3>
      </div>
      <ShadowBoxOnMd className="flex w-full flex-col gap-y-6 md:p-6">
        {donations.map((donation) => (
          <div
            key={donation.id}
            className={twMerge(
              'flex w-full flex-row gap-x-4',
              !donation.message && 'items-center',
            )}
          >
            <Avatar
              className="h-8 w-8"
              avatar_url={donation.donor?.avatar_url ?? null}
              name={getDonorName(donation)}
            />
            <div className="flex w-full flex-col gap-y-2">
              <h3 className="text-sm">
                <span className="font-medium">{getDonorName(donation)}</span>
                {` donated ${formatCurrencyAndAmount(donation.amount, donation.currency)}`}
              </h3>
              {donation.message && (
                <p className="dark:bg-polar-700 rounded-lg bg-gray-100 px-3 py-2 text-sm">
                  {donation.message}
                </p>
              )}
            </div>
          </div>
        ))}
      </ShadowBoxOnMd>
    </div>
  )
}
