'use client'

import { BulkActionBar } from '@/components/BulkActions/BulkActionBar'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import Pagination from '@/components/Pagination/Pagination'
import { ProductListItem } from '@/components/Products/ProductListItem'
import { toast } from '@/components/Toast/use-toast'
import { useProducts, useUpdateProducts } from '@/hooks/queries/products'
import { useSelection } from '@/hooks/useSelection'
import { useDebouncedCallback } from '@/hooks/utils'
import {
  DataTablePaginationState,
  DataTableSortingState,
  serializeSearchParams,
  sortingStateToQueryParam,
} from '@/utils/datatable'
import AddOutlined from '@mui/icons-material/AddOutlined'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import Search from '@mui/icons-material/Search'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Input } from '@polar-sh/orbit'
import { List } from '@polar-sh/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useCallback, useMemo, useState } from 'react'

const getProductId = (product: schemas['Product']) => product.id

const pluralizeProducts = (count: number) =>
  `${count} ${count === 1 ? 'product' : 'products'}`

type BulkAction = 'archive' | 'unarchive'

const BULK_ACTIONS = {
  archive: {
    label: 'Archive',
    pastTense: 'archived',
    title: 'Products Archived',
    partialTitle: 'Some Products Were Not Archived',
    consequence:
      'will stop accepting new purchases. Existing customers keep their benefits and subscriptions continue normally',
    untouchedState: 'archived',
  },
  unarchive: {
    label: 'Unarchive',
    pastTense: 'unarchived',
    title: 'Products Unarchived',
    partialTitle: 'Some Products Were Not Unarchived',
    consequence: 'will be available for purchase again',
    untouchedState: 'active',
  },
} as const satisfies Record<BulkAction, unknown>

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

  const onLimitChange = useCallback(
    (limit: string) => {
      const searchParams = serializeSearchParams(
        { ...pagination, pageSize: parseInt(limit), pageIndex: 0 },
        sorting,
      )
      if (query) {
        searchParams.set('query', query)
      } else {
        searchParams.delete('query')
      }
      router.replace(`${pathname}?${searchParams}`)
    },
    [pagination, router, sorting, pathname, query],
  )

  const onSortingChange = useCallback(
    (value: string) => {
      const desc = value.startsWith('-')
      const id = desc ? value.slice(1) : value
      const newSorting: DataTableSortingState = [{ id, desc }]
      const searchParams = serializeSearchParams(
        { ...pagination, pageIndex: 0 },
        newSorting,
      )
      if (query) {
        searchParams.set('query', query)
      } else {
        searchParams.delete('query')
      }
      router.replace(`${pathname}?${searchParams}`)
    },
    [pagination, router, pathname, query],
  )

  const currentSortingValue =
    sorting.length > 0
      ? `${sorting[0].desc ? '-' : ''}${sorting[0].id}`
      : 'name'

  const debouncedQueryChange = useDebouncedCallback((query: string) => {
    const searchParams = serializeSearchParams(pagination, sorting)
    if (query) {
      searchParams.set('query', query)
    } else {
      searchParams.delete('query')
    }
    router.replace(`${pathname}?${searchParams}`)
  }, 500)

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

  const items = useMemo(
    () =>
      [...(products.data?.items ?? [])].sort((a, b) => {
        if (a.is_archived === b.is_archived) return 0
        return a.is_archived ? 1 : -1
      }),
    [products.data],
  )

  const selection = useSelection({
    items,
    getId: getProductId,
    resetKey: `${query ?? ''}|${show}`,
  })

  const activeSelected = useMemo(
    () => selection.selected.filter((product) => !product.is_archived),
    [selection.selected],
  )
  const archivedSelected = useMemo(
    () => selection.selected.filter((product) => product.is_archived),
    [selection.selected],
  )

  const archiveProducts = useUpdateProducts()
  const unarchiveProducts = useUpdateProducts()

  const [confirmingAction, setConfirmingAction] = useState<BulkAction | null>(
    null,
  )

  const runBulkAction = useCallback(
    async (action: BulkAction) => {
      const isArchiving = action === 'archive'
      const copy = BULK_ACTIONS[action]
      try {
        const { succeeded, failed } = await (
          isArchiving ? archiveProducts : unarchiveProducts
        ).mutateAsync({
          products: isArchiving ? activeSelected : archivedSelected,
          body: { is_archived: isArchiving },
        })
        if (failed.length > 0) {
          toast({
            title: copy.partialTitle,
            description: `${String(succeeded.length)} ${copy.pastTense}, ${String(failed.length)} failed`,
          })
        } else {
          toast({
            title: copy.title,
            description: `${pluralizeProducts(succeeded.length)} ${copy.pastTense}`,
          })
        }
      } catch {
        toast({
          title: copy.partialTitle,
          description: `No products were ${copy.pastTense}`,
        })
      } finally {
        selection.clear()
      }
    },
    [
      archiveProducts,
      unarchiveProducts,
      activeSelected,
      archivedSelected,
      selection,
    ],
  )

  const isMixedSelection =
    activeSelected.length > 0 && archivedSelected.length > 0

  const confirming = confirmingAction ?? 'archive'
  const confirmingCopy = BULK_ACTIONS[confirming]
  const confirmingTargets =
    confirming === 'archive' ? activeSelected : archivedSelected
  const confirmingUntouched =
    confirming === 'archive' ? archivedSelected : activeSelected

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        {selection.count > 0 ? (
          <BulkActionBar
            stretch
            count={selection.count}
            pageSelectedCount={selection.pageSelectedCount}
            pageSize={selection.pageSize}
            onPageSelectedChange={selection.setPageSelected}
            onClear={selection.clear}
          >
            <Box alignItems="center" columnGap="s">
              {activeSelected.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmingAction('archive')}
                  loading={archiveProducts.isPending}
                >
                  Archive
                  {isMixedSelection ? ` (${activeSelected.length})` : ''}
                </Button>
              )}
              {archivedSelected.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmingAction('unarchive')}
                  loading={unarchiveProducts.isPending}
                >
                  Unarchive
                  {isMixedSelection ? ` (${archivedSelected.length})` : ''}
                </Button>
              )}
            </Box>
          </BulkActionBar>
        ) : (
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
              <Select
                value={currentSortingValue}
                onValueChange={onSortingChange}
              >
                <SelectTrigger className="w-full md:max-w-fit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="-name">Name Z-A</SelectItem>
                  <SelectItem value="-created_at">Newest</SelectItem>
                  <SelectItem value="created_at">Oldest</SelectItem>
                  <SelectItem value="price_amount">
                    Price: Low to High
                  </SelectItem>
                  <SelectItem value="-price_amount">
                    Price: High to Low
                  </SelectItem>
                </SelectContent>
              </Select>
              {(products.data?.pagination.total_count ?? 0) > 20 && (
                <Select
                  value={pagination.pageSize.toString()}
                  onValueChange={onLimitChange}
                >
                  <SelectTrigger className="w-full md:max-w-fit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">Show 20</SelectItem>
                    <SelectItem value="50">Show 50</SelectItem>
                    <SelectItem value="100">Show 100</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
        )}
        {items.length > 0 ? (
          <Pagination
            currentPage={pagination.pageIndex + 1}
            pageSize={pagination.pageSize}
            totalCount={products.data?.pagination.total_count || 0}
            currentURL={serializeSearchParams(pagination, sorting)}
            onPageChange={onPageChange}
          >
            <List size="small">
              {items.map((product) => (
                <ProductListItem
                  key={product.id}
                  organization={org}
                  product={product}
                  currency={org.default_presentment_currency}
                  checked={selection.isSelected(product)}
                  onCheckedChange={(_, event) =>
                    selection.toggle(product, { shiftKey: event.shiftKey })
                  }
                  checkboxVisible={selection.count > 0}
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
      <ConfirmModal
        isShown={confirmingAction !== null}
        hide={() => setConfirmingAction(null)}
        title={`${confirmingCopy.label} ${pluralizeProducts(confirmingTargets.length)}`}
        description={`${pluralizeProducts(confirmingTargets.length)} ${confirmingCopy.consequence}.${
          confirmingUntouched.length > 0
            ? ` ${pluralizeProducts(confirmingUntouched.length)} in your selection ${confirmingUntouched.length === 1 ? 'is' : 'are'} already ${confirmingCopy.untouchedState} and will not be changed.`
            : ''
        }`}
        onConfirm={() => runBulkAction(confirming)}
        destructive={confirming === 'archive'}
        destructiveText={confirmingCopy.label}
      />
    </DashboardBody>
  )
}
