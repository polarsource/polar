'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useModal } from '@/components/Modal/useModal'
import ExportOrdersModal from '@/components/Orders/ExportOrdersModal'
import { OrdersTable } from '@/components/Orders/OrdersTable'
import { type ProductFilter } from '@/components/Products/ProductSelect'
import { toast } from '@/components/Toast/use-toast'
import { type ToolbarAction } from '@/components/Shared/Toolbar/ToolbarActionsMenu'
import { useSafeCopy } from '@/hooks/clipboard'
import { uniqueOrders, useInfiniteOrders } from '@/hooks/queries/orders'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { sortingStateToQueryParam } from '@/utils/datatable'
import { useDateRange } from '@/utils/date'
import useDebounce from '@/utils/useDebounce'
import { enums, schemas } from '@polar-sh/client'
import { Copy, Download } from '@polar-sh/orbit/icons'
import { useRouter } from 'next/navigation'
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import React from 'react'
import { SalesToolbar } from './SalesToolbar'

const PAGE_SIZE = 50
const NO_METADATA_KEYS: string[] = []

const filterParsers = {
  product_id: parseAsArrayOf(parseAsString),
  external_product_id: parseAsArrayOf(parseAsString),
  status: parseAsArrayOf(parseAsStringLiteral(enums.orderStatusValues)),
  metadata: parseAsArrayOf(parseAsString),
  query: parseAsString,
}

interface ClientPageProps {
  organization: schemas['Organization']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization }) => {
  const router = useRouter()

  const { sorting, setSorting } = useDataTableQueryState({
    defaultSorting: [{ id: 'created_at', desc: true }],
    defaultPageSize: PAGE_SIZE,
  })

  const [
    {
      product_id: productId,
      external_product_id: externalProductId,
      status,
      metadata,
      query,
    },
    setFilters,
  ] = useQueryStates(filterParsers)
  const debouncedQuery = useDebounce(query, 300)

  // Without dates in the address, the range runs from the organization's first
  // day until today.
  const { startDate, endDate, setStartDate, setEndDate } = useDateRange()

  const product: ProductFilter = {
    product_id: productId,
    external_product_id: externalProductId,
  }

  const {
    data,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useInfiniteOrders(organization.id, {
    limit: PAGE_SIZE,
    sorting: sortingStateToQueryParam(sorting),
    product_id: productId ?? undefined,
    external_product_id: externalProductId ?? undefined,
    status: status ?? undefined,
    query: debouncedQuery?.trim() || undefined,
    created_after: startDate.toISOString(),
    created_before: endDate.toISOString(),
  })

  const orders = data && uniqueOrders(data.pages)
  // Not while the first page for new filters is loading, and not again after a
  // page failed, or the visible end of the list would retry it without pause.
  const loadMore = () => {
    if (hasNextPage && !isFetching && !isFetchNextPageError) {
      fetchNextPage()
    }
  }

  const totalCount = data?.pages[0]?.pagination.total_count
  const countLabel =
    totalCount === undefined
      ? undefined
      : `${totalCount.toLocaleString('en-US')} ${totalCount === 1 ? 'order' : 'orders'}`

  const {
    isShown: isExportModalShown,
    show: showExportModal,
    hide: hideExportModal,
  } = useModal()

  const safeCopy = useSafeCopy(toast)
  const copyLink = async () => {
    await safeCopy(window.location.href)
    toast({ title: 'Link copied' })
  }
  const actions: ToolbarAction[][] = [
    [
      {
        key: 'export',
        label: 'Export CSV',
        icon: <Download />,
        onSelect: showExportModal,
      },
      {
        key: 'copy-link',
        label: 'Copy link to this view',
        icon: <Copy />,
        onSelect: copyLink,
      },
    ],
  ]

  return (
    <DashboardBody
      title={null}
      wrapperClassName="gap-0 pt-0"
      className="min-h-0 flex-1 pb-0"
      wide
      flush
    >
      <SalesToolbar
        organization={organization}
        product={product}
        onProductSelect={setFilters}
        status={status}
        onStatusSelect={(value) => setFilters({ status: value })}
        query={query}
        onQuerySelect={(value) => setFilters({ query: value })}
        dateRange={{ from: startDate, to: endDate }}
        onDateRangeSelect={(range) => {
          setStartDate(range?.from ?? null)
          setEndDate(range?.to ?? null)
        }}
        actions={actions}
      />
      <OrdersTable
        organization={organization}
        orders={orders}
        metadataKeys={metadata ?? NO_METADATA_KEYS}
        sorting={sorting}
        onSortingChange={setSorting}
        onOpen={(id) =>
          router.push(`/dashboard/${organization.slug}/sales/${id}`)
        }
        footerLabel={countLabel}
        isLoadingMore={isFetchingNextPage}
        onRetry={isFetchNextPageError ? fetchNextPage : undefined}
        onEndReached={loadMore}
      />
      <ExportOrdersModal
        organization={organization}
        productId={productId ?? undefined}
        externalProductId={externalProductId ?? undefined}
        status={status}
        isShown={isExportModalShown}
        hide={hideExportModal}
      />
    </DashboardBody>
  )
}

export default ClientPage
