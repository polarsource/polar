'use client'

import { DashboardBody } from '@/components/Aurora/DashboardBody'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { useProducts } from '@/hooks/queries'
import { useDebouncedCallback } from '@/hooks/utils'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import {
  serializeSearchParams,
  sortingStateToQueryParam,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import {
  DataTablePaginationState,
  DataTableSortingState,
} from '@polar-sh/ui/components/atoms/datatable/DataTable'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useCallback, useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function ProductPage({
  organization: org,
  pagination,
  sorting,
  query: _query,
}: {
  organization: schemas['Organization']
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  query: string | undefined
}) {
  const [query, setQuery] = useState(_query)

  const [show, setShow] = useQueryState('show', {
    defaultValue: 'active',
  })

  const router = useRouter()
  const pathname = usePathname()

  const onPageChange = useCallback(
    (page: number) => {
      const searchParams = serializeSearchParams(pagination, sorting)
      searchParams.set('page', page.toString())
      if (query) {
        searchParams.set('query', query)
      } else {
        searchParams.delete('query')
      }
      router.replace(`${pathname}?${searchParams}`)
    },
    [pagination, router, sorting, pathname, query],
  )

  const debouncedQueryChange = useDebouncedCallback(
    (query: string) => {
      const searchParams = serializeSearchParams(pagination, sorting)
      if (query) {
        searchParams.set('query', query)
      } else {
        searchParams.delete('query')
      }
      router.replace(`${pathname}?${searchParams}`)
    },
    500,
    [pagination, sorting, query, router, pathname],
  )

  const onQueryChange = useCallback(
    (query: string) => {
      setQuery(query)
      debouncedQueryChange(query)
    },
    [debouncedQueryChange],
  )

  const products = useProducts(org.id, {
    query,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    sorting: sortingStateToQueryParam(sorting),
    is_archived: show === 'all' ? null : show === 'active' ? false : true,
  })

  return (
    <DashboardBody className="gap-y-12 p-8">
      <div className="flex flex-col gap-y-12 py-8">
        <div className="grid grid-cols-4">
          <h3 className="text-xl">Product Catalogue</h3>
          <div className="flex flex-row items-center gap-x-2">
            <input
              className="w-full border-none bg-transparent p-0 text-xl shadow-none! ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
              placeholder="Search Products"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>
        </div>
        <div className="dark:border-polar-700 border border-gray-200">
          <section className="grid grid-cols-1 [clip-path:inset(1px_1px_1px_1px)] md:grid-cols-2 lg:grid-cols-4">
            {products.data?.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </section>
        </div>
      </div>
    </DashboardBody>
  )
}

const ProductCard = ({ product }: { product: schemas['Product'] }) => {
  const { organization } = useContext(OrganizationContext)

  const [isHovered, setIsHovered] = useState(false)

  return (
    <Link
      href={`/dashboard/${organization.slug}/catalogue/${product.id}`}
      className={twMerge(
        'relative flex h-96 flex-col justify-between gap-y-4 overflow-hidden rounded-none! bg-transparent p-12 dark:bg-transparent',
        'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200 shadow-none',
        'dark:hover:text-polar-950 hover:text-gray-50',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        className="bg-polar-950 dark:bg-polar-50 absolute inset-0 -z-10 h-full"
        variants={{
          hover: { y: '0%' },
          initial: { y: '100%' },
        }}
        initial="initial"
        animate={isHovered ? 'hover' : 'initial'}
        exit="initial"
        transition={{ duration: 0.2, ease: [0.87, 0, 0.13, 1] }}
      />
      <h3 className="text-2xl">{product.name}</h3>
      <span className="text-2xl">
        <ProductPriceLabel product={product} />
      </span>
    </Link>
  )
}
