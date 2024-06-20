'use client'

import Pagination from '@/components/Pagination/Pagination'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { PurchasesQueryParametersContext } from '@/components/Purchases/PurchasesQueryParametersContext'
import PurchaseSidebar from '@/components/Purchases/PurchasesSidebar'
import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import { useOrganization, useUserSubscriptions } from '@/hooks/queries'
import { DiamondOutlined } from '@mui/icons-material'
import { UserSubscription } from '@polar-sh/sdk'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { useCallback, useContext } from 'react'

export default function ClientPage() {
  const searchParams = useSearchParams()
  const [purchaseParameters, setPurchaseParameters] = useContext(
    PurchasesQueryParametersContext,
  )

  const onPageChange = useCallback(
    (page: number) => {
      setPurchaseParameters((prev) => ({
        ...prev,
        page,
      }))
    },
    [setPurchaseParameters],
  )

  const { data: subscriptions } = useUserSubscriptions({
    active: purchaseParameters.inactive ? undefined : true,
    query: purchaseParameters.query,
    limit: purchaseParameters.limit,
    page: purchaseParameters.page,
  })

  return (
    <div className="flex h-full flex-col gap-12 md:flex-row">
      <div className="flex h-full w-full flex-col gap-y-12 self-stretch md:sticky md:top-[6.5rem] md:max-w-xs">
        <PurchaseSidebar>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="inactive"
              checked={purchaseParameters.inactive}
              onCheckedChange={(e) => {
                setPurchaseParameters((prev) => ({
                  ...prev,
                  inactive: e ? true : false,
                }))
              }}
            />
            <label
              htmlFor="inactive"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Show cancelled
            </label>
          </div>
        </PurchaseSidebar>
      </div>
      {subscriptions?.pagination.total_count === 0 ? (
        <div className="dark:text-polar-400 flex h-full w-full flex-col items-center gap-y-4 pt-32 text-6xl text-gray-600">
          <DiamondOutlined fontSize="inherit" />
          <div className="flex flex-col items-center gap-y-2">
            <h3 className="p-2 text-xl font-medium">
              You have no subscription
            </h3>
            <p className="dark:text-polar-500 min-w-0 truncate text-base text-gray-500">
              Subscribe to creators & unlock benefits as a bonus
            </p>
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-y-6">
          <h3 className="text-lg">Subscriptions</h3>
          <List className="w-full">
            {subscriptions?.items?.map((order) => (
              <Link
                key={order.id}
                className="flex w-full flex-row items-center justify-between"
                href={`/purchases/subscriptions/${order.id}`}
              >
                <ListItem className="w-full">
                  <SubscriptionItem subscription={order} />
                </ListItem>
              </Link>
            ))}
          </List>
          <Pagination
            currentPage={purchaseParameters.page}
            totalCount={subscriptions?.pagination.total_count || 0}
            pageSize={purchaseParameters.limit}
            onPageChange={onPageChange}
            currentURL={searchParams}
          />
        </div>
      )}
    </div>
  )
}

const SubscriptionItem = ({
  subscription,
}: {
  subscription: UserSubscription
}) => {
  const { data: organization } = useOrganization(
    subscription.product.organization_id,
  )

  if (!organization) {
    return null
  }

  return (
    <div className="flex w-full flex-row items-center justify-between">
      <div className="flex flex-row items-baseline gap-x-2">
        <div className="flex flex-row items-center gap-4">
          <SubscriptionGroupIcon
            className="text-xl"
            type={subscription.product.type}
          />
          <div className="flex flex-row items-baseline gap-3">
            <h3>{subscription.product.name}</h3>
            {organization && (
              <>
                <span className="dark:text-polar-500 text-gray-500">·</span>
                <span className="dark:text-polar-500 text-gray-500">
                  {organization.name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-row items-baseline gap-4 text-sm">
        <span className="dark:text-polar-500 capitalize text-gray-500">
          {subscription.status}
        </span>
        <span>
          {subscription.price ? (
            <ProductPriceLabel price={subscription.price} />
          ) : (
            'Free'
          )}
        </span>
      </div>
    </div>
  )
}
