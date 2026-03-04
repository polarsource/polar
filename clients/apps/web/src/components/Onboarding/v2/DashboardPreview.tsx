'use client'

import { useOnboardingData } from './OnboardingContext'

const SIDEBAR_ITEMS = [
  'Products',
  'Orders',
  'Subscriptions',
  'Customers',
  'Metrics',
  'Settings',
]

export function DashboardPreview() {
  const { data } = useOnboardingData()

  const orgName = data.orgName || 'Your Organization'
  const orgSlug = data.orgSlug || 'your-org'
  const currency = (data.defaultCurrency || 'usd').toUpperCase()
  const hasProducts = (data.sellingCategories?.length ?? 0) > 0

  return (
    <div className="flex h-full flex-col overflow-hidden text-[11px]">
      {/* Top nav bar */}
      <div className="dark:border-polar-600 flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <div className="dark:bg-polar-500 h-4 w-4 rounded-sm bg-gray-300" />
        <span className="dark:text-polar-300 truncate font-medium text-gray-700">
          {orgName}
        </span>
        <div className="flex-1" />
        <div className="flex gap-1.5">
          <div className="dark:bg-polar-600 h-2 w-10 rounded bg-gray-200" />
          <div className="dark:bg-polar-600 h-2 w-8 rounded bg-gray-200" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="dark:border-polar-600 flex w-28 shrink-0 flex-col gap-0.5 border-r border-gray-100 px-2 py-2">
          {SIDEBAR_ITEMS.map((item) => (
            <div
              key={item}
              className="dark:text-polar-400 rounded px-1.5 py-1 text-gray-500"
            >
              {item}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden p-3">
          {/* Page header */}
          <div className="mb-3 flex items-center justify-between">
            <span className="dark:text-polar-200 text-xs font-medium text-gray-800">
              Products
            </span>
            <div className="dark:bg-polar-500 rounded bg-blue-100 px-2 py-0.5 text-[10px] text-blue-600 dark:text-blue-300">
              + New
            </div>
          </div>

          {/* Product cards grid */}
          <div className="grid grid-cols-3 gap-2">
            {hasProducts ? (
              data.sellingCategories?.map((cat, i) => (
                <ProductCard
                  key={cat}
                  name={cat}
                  currency={currency}
                  index={i}
                />
              ))
            ) : (
              <>
                <ProductCardSkeleton />
                <ProductCardSkeleton />
                <ProductCardSkeleton />
              </>
            )}
          </div>

          {/* Metrics row */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MetricCard label="Revenue" value={`0 ${currency}`} />
            <MetricCard label="Orders" value="0" />
            <MetricCard label="Customers" value="0" />
          </div>

          {/* Bottom area */}
          <div className="mt-3 flex-1">
            <div className="dark:bg-polar-600 h-2 w-20 rounded bg-gray-200" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="dark:bg-polar-600 h-16 rounded-lg bg-gray-50" />
              <div className="dark:bg-polar-600 h-16 rounded-lg bg-gray-50" />
            </div>
          </div>
        </div>
      </div>

      {/* URL bar */}
      <div className="dark:border-polar-600 dark:text-polar-500 border-t border-gray-100 px-3 py-1.5 text-[10px] text-gray-400">
        polar.sh/{orgSlug}
      </div>
    </div>
  )
}

function ProductCard({
  name,
  currency,
  index,
}: {
  name: string
  currency: string
  index: number
}) {
  const prices = ['9.99', '29', '49', '99', '19.99', '4.99']
  return (
    <div className="dark:border-polar-600 dark:bg-polar-700 flex flex-col gap-1.5 rounded-lg border border-gray-100 bg-white p-2">
      <div className="h-10 rounded bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20" />
      <span className="dark:text-polar-300 truncate text-[10px] font-medium text-gray-700">
        {name}
      </span>
      <span className="dark:text-polar-400 text-[10px] text-gray-400">
        {prices[index % prices.length]} {currency}
      </span>
    </div>
  )
}

function ProductCardSkeleton() {
  return (
    <div className="dark:border-polar-600 dark:bg-polar-700 flex flex-col gap-1.5 rounded-lg border border-gray-100 bg-white p-2">
      <div className="dark:bg-polar-600 h-10 rounded bg-gray-50" />
      <div className="dark:bg-polar-600 h-2 w-16 rounded bg-gray-200" />
      <div className="dark:bg-polar-600 h-2 w-10 rounded bg-gray-100" />
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="dark:border-polar-600 dark:bg-polar-700 rounded-lg border border-gray-100 bg-white p-2">
      <div className="dark:text-polar-400 text-[10px] text-gray-400">
        {label}
      </div>
      <div className="dark:text-polar-200 text-xs font-medium text-gray-700">
        {value}
      </div>
    </div>
  )
}
