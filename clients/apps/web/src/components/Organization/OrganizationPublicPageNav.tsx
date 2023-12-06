'use client'

import { useAuth } from '@/hooks'
import { isFeatureEnabled } from '@/utils/feature-flags'
import {
  Bolt,
  DragIndicatorOutlined,
  HiveOutlined,
  HowToVoteOutlined,
} from '@mui/icons-material'
import {
  Article,
  Organization,
  Repository,
  SubscriptionTier,
  UserSignupType,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { useCallback, useEffect, useState } from 'react'
import { Post as PostComponent } from '../Feed/Posts/Post'
import GithubLoginButton from '../Shared/GithubLoginButton'
import { ProfileMenu } from '../Shared/ProfileSelection'
import { StaggerReveal } from '../Shared/StaggerReveal'
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
  const { currentUser } = useAuth()
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

  const [gotoUrl, setGotoUrl] = useState('')
  useEffect(() => {
    setGotoUrl(window.location.href)
  })

  return (
    <div className="flex flex-row items-center justify-between md:w-full">
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
      {currentUser ? (
        <ProfileMenu className="z-50" />
      ) : (
        <GithubLoginButton
          userSignupType={UserSignupType.BACKER}
          posthogProps={{
            view: 'Maintainer Page',
          }}
          text="Sign in with GitHub"
          gotoUrl={gotoUrl}
        />
      )}
    </div>
  )
}

export const OrganizationPublicPageContent = ({
  posts,
  organization,
  repositories,
  subscriptionTiers,
}: {
  posts: Article[]
  organization: Organization
  repositories: Repository[]
  subscriptionTiers: SubscriptionTier[]
}) => {
  const highlightedTiers = subscriptionTiers.filter(
    (tier) => tier.is_highlighted,
  )

  return (
    <div className="mt-12 flex h-full w-full flex-col md:mt-0">
      {isFeatureEnabled('feed') && (
        <TabsContent className="w-full" value="overview">
          <StaggerReveal className="flex max-w-xl flex-col gap-y-6">
            {posts.map((post) => (
              <StaggerReveal.Child>
                <Link href={`/${organization.name}/posts/${post.slug}`}>
                  <PostComponent article={post} />
                </Link>
              </StaggerReveal.Child>
            ))}
          </StaggerReveal>
        </TabsContent>
      )}
      <TabsContent
        className="w-full"
        value={isFeatureEnabled('feed') ? 'issues' : 'overview'}
      >
        <div className="flex w-full flex-col gap-y-8">
          {highlightedTiers.length > 0 && (
            <PublicSubscriptionUpsell
              organization={organization}
              subscriptionTiers={highlightedTiers}
              subscribePath="/subscribe"
            />
          )}

          <div className="dark:bg-polar-900 dark:border-polar-800 flex min-h-[480px] w-full flex-col gap-y-8 rounded-3xl border border-gray-100 bg-white p-12">
            <div className="flex flex-row items-start justify-between">
              <h2 className="text-lg font-medium">
                Issues looking for funding
              </h2>
            </div>
            <IssuesLookingForFunding organization={organization} />
          </div>
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
