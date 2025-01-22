'use client'

import {
  useCustomerBenefitGrants,
  useCustomerOrders,
  useCustomerSubscriptions,
  usePersonalDashboard,
} from '@/hooks/queries'
import { api } from '@/utils/api'
import { BenefitType, ProductPriceType } from '@polar-sh/api'
import ShadowBox from '@polar-sh/ui/components/atoms/shadowbox'
import Link, { LinkProps } from 'next/link'
import { usePathname } from 'next/navigation'
import { PropsWithChildren, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { DefaultFilters } from '../Issues/filters'

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
  const { data: orders } = useCustomerOrders(api, {
    limit: 1,
    productPriceType: ProductPriceType.ONE_TIME,
  })
  const { data: subscriptions } = useCustomerSubscriptions(api, {
    limit: 1,
    active: true,
  })
  const { data: licenseKeysGrants } = useCustomerBenefitGrants(api, {
    limit: 1,
    type: BenefitType.LICENSE_KEYS,
  })
  const { data: fileDownloadsGrants } = useCustomerBenefitGrants(api, {
    limit: 1,
    type: BenefitType.DOWNLOADABLES,
  })

  const { data: dashboard } = usePersonalDashboard({
    ...DefaultFilters,
    onlyPledged: true,
  })

  const fundedIssues = dashboard?.pages[0].pagination.total_count ?? 0

  return (
    <ShadowBox className="flex w-full flex-shrink-0 flex-col gap-6 border-none bg-gray-50">
      <div className="flex flex-col gap-y-2">
        <h2 className="text-lg font-medium">Library</h2>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Your purchases, subscriptions & benefits
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
          <PurchaseLink href="/purchases/license-keys">
            <span>License Keys</span>
            <span>{licenseKeysGrants?.pagination.total_count || 0}</span>
          </PurchaseLink>
          <PurchaseLink href="/purchases/file-downloads">
            <span>File Downloads</span>
            <span>{fileDownloadsGrants?.pagination.total_count || 0}</span>
          </PurchaseLink>
          {fundedIssues > 0 && (
            <PurchaseLink href="/funding">
              <span className="flex flex-row items-center gap-x-2">
                Funded Issues
              </span>
              <span>{fundedIssues}</span>
            </PurchaseLink>
          )}
        </div>
      </div>
      <>{children}</>
    </ShadowBox>
  )
}

export default PurchaseSidebar
