'use client'

import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

const catalogTabs = [
  { title: 'Products', suffix: '' },
  { title: 'Checkout Links', suffix: '/checkout-links' },
  { title: 'Discounts', suffix: '/discounts' },
  { title: 'Benefits', suffix: '/benefits' },
  { title: 'Meters', suffix: '/meters' },
]

export default function CatalogLayout({ children }: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/products`

  // Hide tabs on detail pages (new product, product edit, etc.)
  const isDetailPage = /\/products\/(new|[0-9a-f-]{36})/.test(pathname)

  if (isDetailPage) {
    return children
  }

  const activeTab =
    catalogTabs.find((t) =>
      t.suffix === ''
        ? pathname === base || pathname === `${base}/`
        : pathname.startsWith(`${base}${t.suffix}`),
    ) ?? catalogTabs[0]

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-6 md:px-8">
        <Tabs value={activeTab.title}>
          <TabsList className="flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0">
            {catalogTabs.map((tab) => (
              <Link
                key={tab.suffix}
                href={`${base}${tab.suffix}`}
                prefetch={true}
              >
                <TabsTrigger
                  className="flex flex-row items-center gap-x-2 px-4"
                  value={tab.title}
                >
                  {tab.title}
                </TabsTrigger>
              </Link>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {children}
    </div>
  )
}
