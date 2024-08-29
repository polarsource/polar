'use client'

import {
  MaintainerUpsell,
  SetupProductsUpsell,
} from '@/components/Dashboard/Upsell'
import PurchaseSidebar from '@/components/Purchases/PurchasesSidebar'
import { useAuth } from '@/hooks'
import { useProducts } from '@/hooks/queries'
import { PropsWithChildren } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  const { authenticated, userOrganizations: organizations } = useAuth()
  const products = useProducts(organizations.map((o) => o.id))

  const shouldShowMaintainerUpsell = authenticated && organizations.length === 0

  const shouldShowProductsUpsell =
    !products.isLoading &&
    (products?.data?.items.filter((p) => p.type !== 'free').length ?? 0) < 1

  return (
    <div className="flex h-full flex-col gap-12 md:flex-row">
      <div className="flex h-full w-full flex-shrink-0 flex-col gap-y-6 self-stretch md:sticky md:top-[3rem] md:max-w-xs">
        <PurchaseSidebar />
        {shouldShowMaintainerUpsell ? (
          <MaintainerUpsell />
        ) : shouldShowProductsUpsell ? (
          <SetupProductsUpsell />
        ) : null}
      </div>
      {children}
    </div>
  )
}
