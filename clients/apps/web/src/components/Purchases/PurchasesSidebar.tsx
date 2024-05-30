'use client'

import { useUserOrders, useUserSubscriptions } from '@/hooks/queries'
import { ProductPriceType } from '@polar-sh/sdk'
import Link, { LinkProps } from 'next/link'
import { usePathname } from 'next/navigation'
import Input from 'polarkit/components/ui/atoms/input'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { PropsWithChildren, useCallback, useContext, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { PurchasesQueryParametersContext } from './PurchasesQueryParametersContext'

const PurchaseLink = ({ ...props }: PropsWithChildren<LinkProps>) => {
  const pathname = usePathname()
  const active = useMemo(
    () => pathname.startsWith(props.href as string),
    [pathname, props.href],
  )
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

const PurchaseSidebar: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  const [purchaseParameters, setPurchaseParameters] = useContext(
    PurchasesQueryParametersContext,
  )

  const { data: orders } = useUserOrders({
    limit: 1,
    productPriceType: ProductPriceType.ONE_TIME,
  })
  const { data: subscriptions } = useUserSubscriptions({
    limit: 1,
    active: true,
  })

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPurchaseParameters((prev) => ({
        ...prev,
        query: e.target.value,
      }))
    },
    [setPurchaseParameters],
  )

  return (
    <ShadowBox className="sticky top-[6.5rem] flex max-w-[320px] flex-col gap-6">
      <h1 className="text-lg font-medium">Purchases</h1>
      <div className="flex flex-col gap-y-3">
        <div className="flex flex-col">
          <PurchaseLink href="/purchases/products">
            <span className="flex flex-row items-center gap-x-2">Products</span>
            <span>{orders?.pagination.total_count || 0}</span>
          </PurchaseLink>
          <PurchaseLink href="/purchases/subscriptions">
            <span className="flex flex-row items-center gap-x-2">
              Subscriptions
            </span>
            <span>{subscriptions?.pagination.total_count || 0}</span>
          </PurchaseLink>
        </div>
      </div>
      <div className="flex flex-col gap-y-3">
        <div className="w-full">
          <Input
            placeholder="Search products or creators"
            onChange={handleSearch}
            value={purchaseParameters.query}
          />
        </div>
      </div>
      <>{children}</>
    </ShadowBox>
  )
}

export default PurchaseSidebar
