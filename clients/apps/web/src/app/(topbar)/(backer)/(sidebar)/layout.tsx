'use client'

import {
  CreatePostUpsell,
  GitHubAuthUpsell,
  MaintainerUpsell,
} from '@/components/Dashboard/Upsell'
import PurchaseSidebar from '@/components/Purchases/PurchasesSidebar'
import { useAuth, useGitHubAccount, usePersonalOrganization } from '@/hooks'
import { useListAdminOrganizations, useListArticles } from '@/hooks/queries'
import { ArticleVisibility } from '@polar-sh/sdk'
import { PropsWithChildren, useEffect } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  const { authenticated, reloadUser } = useAuth()
  const { isLoading: adminOrgsAreLoading } = useListAdminOrganizations()
  const personalOrg = usePersonalOrganization()

  // Reload user on page load to make sure that the github oauth data is up to date
  useEffect(() => {
    reloadUser()
  }, [])

  const posts = useListArticles({
    organizationId: personalOrg?.id,
    isPublished: true,
    visibility: ArticleVisibility.PUBLIC,
  })
  const postsAreLoading = posts.isLoading
  const shouldShowPostUpsell =
    !adminOrgsAreLoading &&
    !postsAreLoading &&
    !!personalOrg &&
    personalOrg.feature_settings?.articles_enabled &&
    (posts.data?.pages.flatMap((page) => page.items).length ?? 0) < 1

  const githubAccount = useGitHubAccount()
  const shouldShowGitHubAuthUpsell = authenticated && !githubAccount

  const listOrganizationQuery = useListAdminOrganizations()

  const shouldShowMaintainerUpsell =
    authenticated && !listOrganizationQuery.isLoading && !personalOrg

  return (
    <div className="flex h-full flex-col gap-12 md:flex-row">
      <div className="flex h-full w-full flex-shrink-0 flex-col gap-y-6 self-stretch md:sticky md:top-[3rem] md:max-w-xs">
        <PurchaseSidebar />
        {shouldShowGitHubAuthUpsell ? (
          <GitHubAuthUpsell />
        ) : shouldShowMaintainerUpsell ? (
          <MaintainerUpsell />
        ) : shouldShowPostUpsell ? (
          <CreatePostUpsell />
        ) : null}
      </div>
      {children}
    </div>
  )
}
