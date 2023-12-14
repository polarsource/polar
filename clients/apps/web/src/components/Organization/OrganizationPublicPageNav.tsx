'use client'

import { useAuth } from '@/hooks'
import { isFeatureEnabled } from '@/utils/feature-flags'
import {
  Article,
  Organization,
  Repository,
  SubscriptionTier,
  UserSignupType,
} from '@polar-sh/sdk'
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation'
import {
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { useSubscriptionTiers } from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'
import { Post as PostComponent } from '../Feed/Posts/Post'
import GithubLoginButton from '../Shared/GithubLoginButton'
import { ProfileMenu } from '../Shared/ProfileSelection'
import { StaggerReveal } from '../Shared/StaggerReveal'
import OrganizationSubscriptionsPublicPage from '../Subscriptions/OrganizationSubscriptionsPublicPage'

interface OrganizationPublicPageNavProps {
  basePath?: string
}

export const OrganizationPublicPageNav = ({
  basePath,
}: OrganizationPublicPageNavProps) => {
  const { currentUser } = useAuth()
  const router = useRouter()

  const search = useSearchParams()
  const pathname = usePathname()

  const { organization: organizationName }: { organization: string } =
    useParams()

  const { data: { items: subscriptionTiers } = { items: [] } } =
    useSubscriptionTiers(organizationName, 100)

  const shouldRenderSubscriptionsTab = (subscriptionTiers?.length ?? 0) > 0

  const handleTabChange = useCallback(
    (value: string) => () => {
      if (search) {
        const params = new URLSearchParams(search)
        params.set('tab', value)
        router.push(`${basePath ?? pathname}?${params.toString()}`)
      }
    },
    [search, router, pathname, basePath],
  )

  const [gotoUrl, setGotoUrl] = useState('')
  useEffect(() => {
    setGotoUrl(window.location.href)
  }, [])

  return (
    <div className="flex flex-row items-center justify-between md:w-full">
      <TabsList className="dark:border-polar-700 hidden dark:border md:flex">
        <TabsTrigger
          value="overview"
          size="small"
          onClick={handleTabChange('overview')}
        >
          Overview
        </TabsTrigger>
        {isFeatureEnabled('feed') && (
          <TabsTrigger
            value="issues"
            size="small"
            onClick={handleTabChange('issues')}
          >
            Issues
          </TabsTrigger>
        )}
        <TabsTrigger
          value="repositories"
          size="small"
          onClick={handleTabChange('repositories')}
        >
          Repositories
        </TabsTrigger>
        {isFeatureEnabled('subscriptions') && shouldRenderSubscriptionsTab && (
          <TabsTrigger
            value="subscriptions"
            size="small"
            onClick={handleTabChange('subscriptions')}
          >
            Subscriptions
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
  return (
    <div className="mt-12 flex h-full w-full flex-col md:mt-0">
      {isFeatureEnabled('feed') && (
        <TabsContent className="w-full" value="overview">
          <StaggerReveal className="flex max-w-xl flex-col gap-y-6">
            {posts.map((post) => (
              <StaggerReveal.Child key={post.id}>
                <PostComponent article={post} />
              </StaggerReveal.Child>
            ))}
          </StaggerReveal>
        </TabsContent>
      )}
      <TabsContent className="w-full" value="repositories"></TabsContent>
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
