'use client'

import Pagination from '@/components/Pagination/Pagination'
import { ProductCard } from '@/components/Products/ProductCard'
import { PurchasesQueryParametersContext } from '@/components/Purchases/PurchasesQueryParametersContext'
import PurchaseSidebar from '@/components/Purchases/PurchasesSidebar'
import { useUserSubscriptions } from '@/hooks/queries'
import { DiamondOutlined } from '@mui/icons-material'
import { UserSubscription } from '@polar-sh/sdk'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
    <div className="flex h-full flex-grow flex-row items-start gap-x-12">
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
        <div className="flex flex-col">
          <div className="grid h-full grid-cols-1 gap-6 md:grid-cols-3">
            {subscriptions?.items?.map((order) => (
              <SubscriptionItem key={order.id} subscription={order} />
            ))}
          </div>
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
  return (
    <Link href={`/purchases/subscriptions/${subscription.id}`}>
      <ProductCard
        key={subscription.id}
        product={subscription.product}
        price={subscription.price}
        showOrganization
      />
    </Link>
  )
}
