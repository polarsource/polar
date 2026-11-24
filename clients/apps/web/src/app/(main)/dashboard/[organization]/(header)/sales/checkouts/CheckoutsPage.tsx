'use client'

import { CheckoutsTable } from '@/components/Checkouts/CheckoutsTable'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { type ProductFilter } from '@/components/Products/ProductSelect'
import { type ToolbarAction } from '@/components/Shared/Toolbar/ToolbarActionsMenu'
import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import {
  uniqueCheckouts,
  useInfiniteCheckouts,
} from '@/hooks/queries/checkouts'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { sortingStateToQueryParam } from '@/utils/datatable'
import useDebounce from '@/utils/useDebounce'
import { enums, schemas } from '@polar-sh/client'
import { Copy } from '@polar-sh/orbit/icons'
import { useRouter } from 'next/navigation'
import {
  parseAsArrayOf,
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import React from 'react'
import { CheckoutsToolbar } from './CheckoutsToolbar'

const PAGE_SIZE = 50
const filterParsers = {
  product_id: parseAsArrayOf(parseAsString),
  external_product_id: parseAsArrayOf(parseAsString),
  customer_id: parseAsArrayOf(parseAsString),
  status: parseAsArrayOf(parseAsStringLiteral(enums.checkoutStatusValues)),
  query: parseAsString,
  created_after: parseAsIsoDateTime,
  created_before: parseAsIsoDateTime,
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
      customer_id: customerId,
      status,
      query,
      created_after: createdAfter,
      created_before: createdBefore,
    },
    setFilters,
  ] = useQueryStates(filterParsers)
  const debouncedQuery = useDebounce(query, 300)

  const product: ProductFilter = {
    product_id: productId,
    external_product_id: externalProductId,
  }
  // Half a range filters nothing.
  const created =
    createdAfter && createdBefore
      ? { from: createdAfter, to: createdBefore }
      : null

  const {
    data,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useInfiniteCheckouts(organization.id, {
    limit: PAGE_SIZE,
    sorting: sortingStateToQueryParam(sorting),
    product_id: productId ?? undefined,
    external_product_id: externalProductId ?? undefined,
    customer_id: customerId ?? undefined,
    status: status ?? undefined,
    query: debouncedQuery?.trim() || undefined,
    created_after: created?.from.toISOString(),
    created_before: created?.to.toISOString(),
  })

  const checkouts = data && uniqueCheckouts(data.pages)
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
      : `${totalCount.toLocaleString('en-US')} ${totalCount === 1 ? 'checkout' : 'checkouts'}`

  const safeCopy = useSafeCopy(toast)
  const copyLink = async () => {
    await safeCopy(window.location.href)
    toast({ title: 'Link copied' })
  }
  const actions: ToolbarAction[][] = [
    [
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
      <CheckoutsToolbar
        organization={organization}
        product={product}
        onProductSelect={setFilters}
        status={status}
        onStatusSelect={(value) => setFilters({ status: value })}
        customerId={customerId}
        onCustomerSelect={(value) => setFilters({ customer_id: value })}
        query={query}
        onQuerySelect={(value) => setFilters({ query: value })}
        created={created}
        onCreatedSelect={(range) =>
          setFilters({
            created_after: range?.from ?? null,
            created_before: range?.to ?? null,
          })
        }
        actions={actions}
      />
      <CheckoutsTable
        organization={organization}
        checkouts={checkouts}
        sorting={sorting}
        onSortingChange={setSorting}
        onOpen={(id) =>
          router.push(`/dashboard/${organization.slug}/sales/checkouts/${id}`)
        }
        footerLabel={countLabel}
        isLoadingMore={isFetchingNextPage}
        onRetry={isFetchNextPageError ? fetchNextPage : undefined}
        onEndReached={loadMore}
      />
    </DashboardBody>
  )
}

export default ClientPage
