'use client'

import Pagination from '@/components/Pagination/Pagination'
import { ProductCard } from '@/components/Products/ProductCard'
import { PurchasesQueryParametersContext } from '@/components/Purchases/PurchasesQueryParametersContext'
import PurchaseSidebar from '@/components/Purchases/PurchasesSidebar'
import { useUserOrders } from '@/hooks/queries'
import { DiamondOutlined } from '@mui/icons-material'
import { ProductPriceType, UserOrder } from '@polar-sh/sdk'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
            <h3 className="p-2 text-xl font-medium">You have no purchase</h3>
            <p className="dark:text-polar-500 min-w-0 truncate text-base text-gray-500">
              Buy products from creators & unlock benefits as a bonus
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="grid h-full grid-cols-1 gap-6 md:grid-cols-3">
            {orders?.items.map((order) => (
              <OrderItem key={order.id} order={order} />
            ))}
          </div>
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
  return (
    <Link href={`/purchases/products/${order.id}`}>
      <ProductCard
        key={order.id}
        product={order.product}
        price={order.product_price}
        showOrganization
      />
    </Link>
  )
}
