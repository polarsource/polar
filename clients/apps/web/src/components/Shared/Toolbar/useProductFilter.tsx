import { type Filter } from '@/components/Shared/FilterPopover'
import { type ProductFilter } from '@/components/Products/ProductSelect'
import {
  latestVersions,
  useInfiniteProducts,
  useSelectedProducts,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Package } from '@polar-sh/orbit/icons'
import { useState } from 'react'
import { uniqueOptions } from './filterOptions'

// Products are searched on the server and load page by page, since a catalog
// can hold more than one page of them. The selected ones are fetched on their
// own and stay at the top, so they keep their names whatever the search shows.
const PAGE_SIZE = 50

export const useProductFilter = (
  organization: schemas['Organization'],
  product: ProductFilter,
  onProductSelect: (product: ProductFilter) => void,
  { recurringOnly = false }: { recurringOnly?: boolean } = {},
): Filter => {
  const [query, setQuery] = useState('')
  // A product_id link keeps filtering by ID until the selection is cleared
  const filterByExternalId =
    !!organization.feature_settings?.config_as_code_enabled &&
    !product.product_id
  const selectedValues =
    (filterByExternalId ? product.external_product_id : product.product_id) ??
    []

  const {
    data,
    isPending,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useInfiniteProducts(organization.id, {
    ...(recurringOnly ? { is_recurring: true } : {}),
    // Sales outlive their product being archived or leaving the live catalog,
    // so those are listed as well.
    is_archived: null,
    catalog_status: null,
    ...(query ? { query } : {}),
    sorting: ['name'],
    limit: PAGE_SIZE,
  })
  const { data: selectedProducts } = useSelectedProducts(
    filterByExternalId
      ? { organization_id: organization.id, external_id: selectedValues }
      : { id: selectedValues },
    { includeArchived: true, includeAllVersions: true },
  )
  const listedProducts = (data?.pages ?? []).flatMap((page) => page.items)
  const products = [
    ...(selectedProducts ?? []),
    ...listedProducts.filter(
      (listed) => !selectedProducts?.some(({ id }) => id === listed.id),
    ),
  ]

  return {
    key: 'product',
    label: 'Product',
    icon: <Package className="size-4" />,
    type: 'multi',
    options: uniqueOptions(
      (filterByExternalId ? latestVersions(products) : products).flatMap(
        ({ id, external_id: externalId, name, is_archived: isArchived }) => {
          const value = filterByExternalId ? externalId : id
          return value
            ? [{ value, label: `${name}${isArchived ? ' (Archived)' : ''}` }]
            : []
        },
      ),
    ),
    value: selectedValues,
    onChange: (value) => {
      const selected = value.length > 0 ? value : null
      onProductSelect(
        filterByExternalId
          ? { product_id: null, external_product_id: selected }
          : { product_id: selected, external_product_id: null },
      )
    },
    searchPlaceholder: 'Search products...',
    searchQuery: query,
    onSearchQueryChange: setQuery,
    loading: isPending,
    loadingMore: isFetchingNextPage,
    loadMoreFailed: isFetchNextPageError,
    onEndReached: () => {
      if (hasNextPage && !isFetching) fetchNextPage()
    },
  }
}
