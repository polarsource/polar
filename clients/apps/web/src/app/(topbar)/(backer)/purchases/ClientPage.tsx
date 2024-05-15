'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { useUser, useUserSubscriptions } from '@/hooks/queries'
import { Purchase, usePurchases } from '@/hooks/queries/purchases'
import { Organization } from '@polar-sh/sdk'
import Link, { LinkProps } from 'next/link'
import { useSearchParams } from 'next/navigation'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Input from 'polarkit/components/ui/atoms/input'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { PropsWithChildren, useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function ClientPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const user = useUser()

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
    },
    [setSearchQuery],
  )

  const { data: purchases } = usePurchases()
  const { data: subscriptions } = useUserSubscriptions(
    user.data?.id,
    undefined,
    999,
  )

  const searchParams = useSearchParams()

  const activeOrganization = searchParams.get('organization')

  const purchaseItems = useMemo(() => {
    return [
      ...(purchases?.items ?? []),
      ...(subscriptions?.items?.map((subscription) => ({
        id: subscription.id,
        product: subscription.product,
        created_at: subscription.created_at,
        updated_at: new Date().toISOString(),
      })) ?? []),
    ]
  }, [purchases, subscriptions])

  const filteredPurchases = useMemo(() => {
    const items =
      purchaseItems.filter((purchase) =>
        'organization' in purchase.product
          ? purchase.product.organization.name
              .toLowerCase()
              .includes(activeOrganization?.toLocaleLowerCase() ?? '')
          : true,
      ) ?? []

    return items.filter((purchase) =>
      purchase.product.name.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [activeOrganization, searchQuery, purchaseItems])

  const creators = useMemo(() => {
    const creatorMap = new Map<
      string,
      { organization: Organization; count: number }
    >()

    for (const org of purchases?.items.map((purchase) =>
      'organization' in purchase.product
        ? purchase.product.organization
        : undefined,
    ) ?? []) {
      if (!org) continue

      if (creatorMap.has(org.name)) {
        creatorMap.set(org.name, {
          organization: org,
          count: (creatorMap.get(org.name)?.count ?? 0) + 1,
        })
      } else {
        creatorMap.set(org.name, {
          organization: org,
          count: 1,
        })
      }
    }

    return creatorMap
  }, [purchases])

  return (
    <div className="flex h-full flex-grow flex-row items-start gap-x-12">
      <ShadowBox className="sticky top-[6.5rem] flex max-w-[320px] flex-col gap-6">
        <h1 className="text-lg font-medium">Purchases</h1>
        <Input
          placeholder="Search Purchases"
          onChange={handleSearch}
          value={searchQuery}
        />
        <div className="flex flex-col gap-y-3">
          <h3 className="text-sm font-medium">Type</h3>
          <div className="flex flex-col">
            <PurchaseLink href="#" active={true}>
              <span className="flex flex-row items-center gap-x-2">All</span>
              <span>{purchaseItems.length ?? 0}</span>
            </PurchaseLink>
            <PurchaseLink href="#" active={false}>
              <span className="flex flex-row items-center gap-x-2">
                Product
              </span>
              <span>{purchases?.items.length ?? 0}</span>
            </PurchaseLink>
            <PurchaseLink href="#" active={false}>
              <span className="flex flex-row items-center gap-x-2">
                Subscriptions
              </span>
              <span>{subscriptions?.items?.length ?? 0}</span>
            </PurchaseLink>
          </div>
        </div>
        <div className="flex flex-col gap-y-3">
          <h3 className="text-sm font-medium">Creators</h3>
          <div className="flex flex-col">
            <PurchaseLink
              active={activeOrganization === null}
              href="/purchases"
            >
              <span>All</span>
              <span>{purchases?.items.length ?? 0}</span>
            </PurchaseLink>
            {[...creators.entries()].map(([orgName, details]) => {
              const active =
                orgName.toLowerCase().split(' ').join('-') ===
                activeOrganization

              const href = `/purchases?organization=${orgName.toLowerCase().split(' ').join('-')}`

              return (
                <PurchaseLink active={active} key={orgName} href={href}>
                  <span className="flex flex-row items-center gap-x-2">
                    <Avatar
                      className="h-5 w-5"
                      avatar_url={details.organization.avatar_url}
                      name={details.organization.name}
                    />
                    <span>
                      {details.organization.pretty_name ??
                        details.organization.name}
                    </span>
                  </span>
                  <span>{details.count}</span>
                </PurchaseLink>
              )
            })}
          </div>
        </div>
      </ShadowBox>
      <div className="grid h-full grid-cols-1 gap-6 md:grid-cols-3">
        {filteredPurchases.map((purchase) => (
          <PurchaseItem key={purchase.id} purchase={purchase} />
        ))}
      </div>
    </div>
  )
}

const PurchaseLink = ({
  active,
  ...props
}: PropsWithChildren<LinkProps & { active: boolean }>) => {
  return (
    <Link
      className={twMerge(
        'flex cursor-pointer flex-row items-center justify-between gap-x-2 rounded-xl bg-transparent px-4 py-2 text-sm text-gray-500 transition-colors hover:text-blue-500 dark:hover:text-blue-50',
        active
          ? 'dark:bg-polar-700 bg-blue-50 text-blue-500 dark:text-blue-50'
          : '',
      )}
      {...props}
    />
  )
}

const PurchaseItem = ({ purchase }: { purchase: Purchase }) => {
  return (
    <Link href={`/purchases/${purchase.id}`}>
      {'organization' in purchase.product ? (
        <ProductCard
          key={purchase.id}
          product={purchase.product}
          showOrganization
        />
      ) : (
        <SubscriptionTierCard subscriptionTier={purchase.product} />
      )}
    </Link>
  )
}
