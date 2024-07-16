'use client'

import {
  GitHubAuthUpsell,
  MaintainerUpsell,
  SetupProductsUpsell,
} from '@/components/Dashboard/Upsell'
import PurchaseSidebar from '@/components/Purchases/PurchasesSidebar'
import { useAuth, useGitHubAccount, usePersonalOrganization } from '@/hooks'
import { useListMemberOrganizations, useProducts } from '@/hooks/queries'
import { PropsWithChildren, useEffect } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  const { authenticated, reloadUser } = useAuth()
  const { isLoading: adminOrgsAreLoading } = useListMemberOrganizations()
  const personalOrg = usePersonalOrganization()

  // Reload user on page load to make sure that the github oauth data is up to date
  useEffect(() => {
    reloadUser()
  }, [])

  const products = useProducts(personalOrg?.id)
  const productsAreLoading = products.isLoading
  const shouldShowProductsUpsell =
    !adminOrgsAreLoading &&
    !productsAreLoading &&
    !!personalOrg &&
    personalOrg.feature_settings?.subscriptions_enabled &&
    (products?.data?.items?.filter((p) => p.type !== 'free').length ?? 0) < 1

  const githubAccount = useGitHubAccount()
  const shouldShowGitHubAuthUpsell = authenticated && !githubAccount

  const listOrganizationQuery = useListMemberOrganizations()

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
        ) : shouldShowProductsUpsell ? (
          <SetupProductsUpsell />
        ) : null}
      </div>
      {children}
    </div>
  )
}
