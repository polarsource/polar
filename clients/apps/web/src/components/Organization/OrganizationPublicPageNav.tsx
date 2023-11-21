'use client'

import { isFeatureEnabled } from '@/utils/feature-flags'
import {
  Bolt,
  DragIndicatorOutlined,
  HiveOutlined,
  HowToVoteOutlined,
} from '@mui/icons-material'
import { Organization, Repository, SubscriptionTier } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { useCallback } from 'react'
import { Post as PostComponent } from '../Feed/Posts/Post'
import { Post } from '../Feed/data'
import ProfileSelection from '../Shared/ProfileSelection'
import OrganizationSubscriptionsPublicPage from '../Subscriptions/OrganizationSubscriptionsPublicPage'
import PublicSubscriptionUpsell from '../Subscriptions/PublicSubscriptionUpsell'
import IssuesLookingForFunding from './IssuesLookingForFunding'
import { RepositoriesOverivew } from './RepositoriesOverview'

interface OrganizationPublicPageNavProps {
  shouldRenderSubscriptionsTab: boolean
}

export const OrganizationPublicPageNav = ({
  shouldRenderSubscriptionsTab,
}: OrganizationPublicPageNavProps) => {
  const router = useRouter()

  const search = useSearchParams()
  const pathname = usePathname()

  const handleTabChange = useCallback(
    (value: string) => () => {
      const params = new URLSearchParams(search)
      params.set('tab', value)
      router.push(`${pathname}?${params.toString()}`)
    },
    [search, router, pathname],
  )

  return (
    <div className="flex w-full flex-row items-center md:grow-0 md:justify-between">
      <TabsList className="dark:border-polar-700 hidden dark:border md:flex">
        <TabsTrigger
          value="overview"
          size="small"
          onClick={handleTabChange('overview')}
        >
          <div className="text-[18px]">
            <DragIndicatorOutlined fontSize="inherit" />
          </div>
          <span>Overview</span>
        </TabsTrigger>
        {isFeatureEnabled('feed') && (
          <TabsTrigger
            value="issues"
            size="small"
            onClick={handleTabChange('issues')}
          >
            <div className="text-[18px]">
              <HowToVoteOutlined fontSize="inherit" />
            </div>
            <span>Issues</span>
          </TabsTrigger>
        )}
        <TabsTrigger
          value="repositories"
          size="small"
          onClick={handleTabChange('repositories')}
        >
          <div className="text-[18px]">
            <HiveOutlined fontSize="inherit" />
          </div>
          <span>Repositories</span>
        </TabsTrigger>
        {isFeatureEnabled('subscriptions') && shouldRenderSubscriptionsTab && (
          <TabsTrigger
            value="subscriptions"
            size="small"
            onClick={handleTabChange('subscriptions')}
          >
            <div className="text-[18px]">
              <Bolt fontSize="inherit" />
            </div>
            <span>Subscriptions</span>
          </TabsTrigger>
        )}
      </TabsList>
      <div className="z-50 w-full md:w-[280px]">
        <ProfileSelection
          narrow
          showBackerLinks
          useOrgFromURL={false}
          className="border border-gray-100 shadow-sm"
        />
      </div>
    </div>
  )
}

export const OrganizationPublicPageContent = ({
  posts,
  organization,
  repositories,
  subscriptionTiers,
}: {
  posts: Post[]
  organization: Organization
  repositories: Repository[]
  subscriptionTiers: SubscriptionTier[]
}) => {
  return (
    <div className="mt-12 flex h-full w-full flex-col md:mt-0">
      {isFeatureEnabled('feed') && (
        <TabsContent className="w-full" value="overview">
          <div className="flex max-w-xl flex-col gap-y-6">
            {posts.map((post) => (
              <Link href={`/${organization.name}/posts/${post.id}`}>
                <PostComponent {...post} />
              </Link>
            ))}
          </div>
        </TabsContent>
      )}
      <TabsContent
        className="w-full"
        value={isFeatureEnabled('feed') ? 'issues' : 'overview'}
      >
        <div className="flex w-full flex-col gap-y-8">
          {subscriptionTiers.length > 0 && (
            <PublicSubscriptionUpsell
              organization={organization}
              subscriptionTiers={subscriptionTiers}
              subscribePath="/subscribe"
            />
          )}

          <div className="flex flex-row items-start justify-between">
            <h2 className="text-lg">Issues looking for funding</h2>
          </div>
          <IssuesLookingForFunding organization={organization} />
        </div>
      </TabsContent>
      <TabsContent className="w-full" value="repositories">
        <RepositoriesOverivew
          organization={organization}
          repositories={repositories}
        />
      </TabsContent>
      {subscriptionTiers.length > 0 && (
        <TabsContent className="w-full" value="subscriptions">
          <OrganizationSubscriptionsPublicPage
            organization={organization}
            subscriptionTiers={subscriptionTiers}
          />
        </TabsContent>
      )}
    </div>
  )
}
