'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import Pagination from '@/components/Pagination/Pagination'
import { PurchasesQueryParametersContext } from '@/components/Purchases/PurchasesQueryParametersContext'
import PurchaseSidebar from '@/components/Purchases/PurchasesSidebar'
import AmountLabel from '@/components/Shared/AmountLabel'
import { useOrganization, useUserOrders } from '@/hooks/queries'
import { DiamondOutlined } from '@mui/icons-material'
import { ProductPriceType, UserOrder } from '@polar-sh/sdk'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
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

  const { data: orders } = useUserOrders({
    productPriceType: ProductPriceType.ONE_TIME,
    query: purchaseParameters.query,
    limit: purchaseParameters.limit,
    page: purchaseParameters.page,
  })

  return (
    <div className="flex h-full flex-col gap-12 md:flex-row">
      <div className="flex h-full w-full flex-shrink-0 flex-col gap-y-12 self-stretch md:sticky md:top-[3rem] md:max-w-xs">
        <PurchaseSidebar />
      </div>
      {orders?.pagination.total_count === 0 ? (
        <div className="dark:text-polar-400 flex h-full w-full flex-col items-center gap-y-4 pt-32 text-6xl text-gray-600">
          <DiamondOutlined fontSize="inherit" />
          <div className="flex flex-col items-center gap-y-2">
            <h3 className="p-2 text-xl font-medium">You have no purchases</h3>
            <p className="dark:text-polar-500 min-w-0 truncate text-base text-gray-500">
              Buy products from creators & unlock benefits as a bonus
            </p>
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-2xl flex-col gap-y-6">
          {orders?.items.map((order) => (
            <Link
              key={order.id}
              className="flex w-full flex-row items-center justify-between"
              href={`/purchases/products/${order.id}`}
            >
              <OrderItem key={order.id} order={order} />
            </Link>
          ))}
          <Pagination
            currentPage={purchaseParameters.page}
            totalCount={orders?.pagination.total_count || 0}
            pageSize={purchaseParameters.limit}
            onPageChange={onPageChange}
            currentURL={searchParams}
          />
        </div>
      )}
    </div>
  )
}

const OrderItem = ({ order }: { order: UserOrder }) => {
  const { data: organization } = useOrganization(order.product.organization_id)

  if (!organization) {
    return null
  }

  return (
    <ShadowBox className="flex w-full flex-col gap-y-6">
      <div className="flex flex-row items-start justify-between">
        <div className="flex flex-row items-center gap-x-4">
          {order.product.medias.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="dark:bg-polar-950 aspect-square h-16 rounded-2xl bg-gray-100 object-cover"
              alt={order.product.medias[0].name}
              width={600}
              height={600}
              src={order.product.medias[0].public_url}
            />
          ) : (
            <div className="dark:from-polar-900 dark:via-polar-800 dark:to-polar-900 flex aspect-square h-16 flex-col items-center justify-center rounded-2xl bg-gradient-to-tr from-white via-blue-50 to-white">
              <div className="flex flex-col items-center justify-center text-4xl text-blue-500 dark:text-white">
                <LogoIcon className="dark:text-polar-600 h-12 w-12 text-white/50" />
              </div>
            </div>
          )}
          <div className="flex flex-col">
            <h3 className="truncate text-2xl">{order.product.name}</h3>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              {organization.name}
            </p>
          </div>
        </div>
        <Link href={`/purchases/products/${order.id}`}>
          <Button size="sm">View Purchase</Button>
        </Link>
      </div>
      <div className="dark:divide-polar-700 flex flex-col divide-y divide-gray-100 text-sm">
        <div className="flex flex-row items-center justify-between py-2">
          <span>Amount</span>
          {order.amount && order.currency ? (
            <AmountLabel amount={order.amount} currency={order.currency} />
          ) : (
            'Free'
          )}
        </div>
        {order.created_at && (
          <div className="flex flex-row items-center justify-between py-3">
            <span>Purchase Date</span>
            <span>
              {new Date(order.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
        {order.product.benefits.length > 0 && (
          <div className="flex flex-row items-center justify-between py-3">
            <span>Benefits</span>
            <span>
              <Link href={`/purchases/products/${order.id}`}>
                <Button size="sm" variant="secondary">
                  View Benefits
                </Button>
              </Link>
            </span>
          </div>
        )}
      </div>
    </ShadowBox>
  )
}
