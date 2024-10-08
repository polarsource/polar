'use client'

import { useUserOrders, useUserSubscriptions } from '@/hooks/queries'
import { ProductPriceType } from '@polar-sh/sdk'
import Link, { LinkProps } from 'next/link'
import { usePathname } from 'next/navigation'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { PropsWithChildren, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const PurchaseLink = ({ ...props }: PropsWithChildren<LinkProps>) => {
  const pathname = usePathname()
  const active = useMemo(
    () => pathname.startsWith(props.href as string),
    [pathname, props.href],
  )
  return (
    <Link
      className={twMerge(
        'dark:text-polar-500 flex cursor-pointer flex-row items-center justify-between gap-x-2 rounded-lg bg-transparent px-4 py-2 text-sm text-gray-500 transition-colors [font-feature-settings:"tnum"] hover:text-black dark:hover:text-blue-50',
        active
          ? 'dark:bg-polar-800 bg-white font-medium text-black shadow-sm dark:text-blue-50'
          : '',
      )}
      {...props}
    />
  )
}

const PurchaseSidebar: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  const { data: orders } = useUserOrders({
    limit: 1,
    productPriceType: ProductPriceType.ONE_TIME,
  })
  const { data: subscriptions } = useUserSubscriptions({
    limit: 1,
    active: true,
  })

  return (
    <ShadowBox className="flex w-full flex-shrink-0 flex-col gap-6 border-gray-200/50 bg-gray-50">
      <div className="flex flex-col gap-y-2">
        <h2 className="text-lg font-medium">Library</h2>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Your purchases, subscriptions & funded issues
        </p>
      </div>
      <div className="flex flex-col gap-y-3">
        <div className="-mx-4 flex flex-col">
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
          <PurchaseLink href="/funding">
            <span className="flex flex-row items-center gap-x-2">
              Funded Issues
            </span>
          </PurchaseLink>
        </div>
      </div>
      <>{children}</>
    </ShadowBox>
  )
}

export default PurchaseSidebar
