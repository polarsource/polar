'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Pagination from '@/components/Pagination/Pagination'
import { ProductListItem } from '@/components/Products/ProductListItem'
import { useProducts } from '@/hooks/queries/products'
import { useDebouncedCallback } from '@/hooks/utils'
import {
  DataTablePaginationState,
  DataTableSortingState,
  serializeSearchParams,
  sortingStateToQueryParam,
} from '@/utils/datatable'
import { AddOutlined, HiveOutlined, Search } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { List } from '@polar-sh/ui/components/atoms/List'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useCallback, useState } from 'react'

export default function ClientPage({
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
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Input
              className="w-full md:max-w-64"
              preSlot={<Search fontSize="small" />}
              placeholder="Search Products"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            <Select value={show} onValueChange={setShow}>
              <SelectTrigger className="w-full md:max-w-fit">
                <SelectValue placeholder="Show archived products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Link
            href={`/dashboard/${org.slug}/products/new`}
            className="w-full md:w-fit"
          >
            <Button
              role="link"
              wrapperClassNames="gap-x-2 md:w-fit"
              className="w-full"
            >
              <AddOutlined className="h-4 w-4" />
              <span>New Product</span>
            </Button>
          </Link>
        </div>
        {products.data && products.data.items.length > 0 ? (
          <Pagination
            currentPage={pagination.pageIndex + 1}
            pageSize={pagination.pageSize}
            totalCount={products.data?.pagination.total_count || 0}
            currentURL={serializeSearchParams(pagination, sorting)}
            onPageChange={onPageChange}
          >
            <List size="small">
              {products.data.items
                .sort((a, b) => {
                  if (a.is_archived === b.is_archived) return 0
                  return a.is_archived ? 1 : -1
                })
                .map((product) => (
                  <ProductListItem
                    key={product.id}
                    organization={org}
                    product={product}
                  />
                ))}
            </List>
          </Pagination>
        ) : (
          <ShadowBoxOnMd className="items-center justify-center gap-y-6 md:flex md:flex-col md:py-48">
            <HiveOutlined
              className="dark:text-polar-600 text-5xl text-gray-300"
              fontSize="large"
            />
            <div className="flex flex-col items-center gap-y-6">
              <div className="flex flex-col items-center gap-y-2">
                <h3 className="text-lg font-medium">No products found</h3>
                <p className="dark:text-polar-500 text-gray-500">
                  Start selling digital products today
                </p>
              </div>
              <Link href={`/dashboard/${org.slug}/products/new`}>
                <Button role="link" variant="secondary">
                  <span>Create Product</span>
                </Button>
              </Link>
            </div>
          </ShadowBoxOnMd>
        )}
      </div>
    </DashboardBody>
  )
}
