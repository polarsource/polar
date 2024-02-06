'use client'

import {
  CreatePostUpsell,
  GitHubAuthUpsell,
  MaintainerUpsell,
} from '@/components/Dashboard/Upsell'
import { FeaturedCreators } from '@/components/Feed/FeaturedCreators'
import { Feed } from '@/components/Feed/Feed'
import { MySubscriptions } from '@/components/Feed/MySubscriptions'
import { useAuth, useGitHubAccount, usePersonalOrganization } from '@/hooks'
import {
  useListAdminOrganizations,
  useSearchArticles,
  useUserSubscriptions,
} from 'polarkit/hooks'
import { useEffect } from 'react'

export default function Page() {
  const { currentUser, authenticated, reloadUser } = useAuth()
  const { isLoading: adminOrgsAreLoading } = useListAdminOrganizations()
  const personalOrg = usePersonalOrganization()

  const userSubscriptions = useUserSubscriptions(
    currentUser?.id,
    undefined,
    9999,
  )

  // Reload user on page load to make sure that the github oauth data is up to date
  useEffect(() => {
    reloadUser()
  }, [])

  const posts = useSearchArticles(personalOrg?.name ?? '')
  const postsAreLoading = posts.isLoading
  const shouldShowPostUpsell =
    !adminOrgsAreLoading &&
    !postsAreLoading &&
    !!personalOrg &&
    (posts.data?.pages.flatMap((page) => page.items).length ?? 0) < 1

  const githubAccount = useGitHubAccount()
  const shouldShowGitHubAuthUpsell = authenticated && !githubAccount

  const listOrganizationQuery = useListAdminOrganizations()

  const shouldShowMaintainerUpsell =
    authenticated && !listOrganizationQuery.isLoading && !personalOrg

  const subscriptionsToRender = userSubscriptions.data?.items ?? []

  return (
    <div className="relative flex h-full flex-col justify-center md:flex-row md:gap-x-24 md:pt-6">
      <div className="flex w-full flex-col gap-y-8 pb-12 md:max-w-xl">
        <Feed />
      </div>
      <div className="flex h-full flex-col gap-y-12 self-stretch md:max-w-xs">
        {shouldShowGitHubAuthUpsell ? (
          <GitHubAuthUpsell />
        ) : shouldShowMaintainerUpsell ? (
          <MaintainerUpsell />
        ) : shouldShowPostUpsell ? (
          <CreatePostUpsell />
        ) : null}
        <FeaturedCreators />
        {subscriptionsToRender.length > 0 && (
          <MySubscriptions subscriptions={subscriptionsToRender} />
        )}
      </div>
    </div>
  )
}
