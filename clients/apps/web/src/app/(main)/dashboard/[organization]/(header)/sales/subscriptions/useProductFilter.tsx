import { type Filter } from '@/components/Shared/FilterPopover'
import { type ProductFilter } from '@/components/Products/ProductSelect'
import {
  latestVersions,
  useProducts,
  useSelectedProducts,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Package } from '@polar-sh/orbit/icons'
import { useState } from 'react'

// Products are searched on the server, since a catalog can hold more than one
// page of them. The selected ones are fetched on their own and stay at the
// top, so they keep their names whatever the search shows.
export const useProductFilter = (
  organization: schemas['Organization'],
  product: ProductFilter,
  onProductSelect: (product: ProductFilter) => void,
): Filter => {
  const [query, setQuery] = useState('')
  // A product_id link keeps filtering by ID until the selection is cleared
  const filterByExternalId =
    !!organization.feature_settings?.config_as_code_enabled &&
    !product.product_id
  const selectedValues =
    (filterByExternalId ? product.external_product_id : product.product_id) ??
    []

  const { data: queriedProducts, isPending } = useProducts(organization.id, {
    is_recurring: true,
    ...(query ? { query, catalog_status: null } : {}),
    sorting: ['name'],
    limit: 100,
  })
  const { data: selectedProducts } = useSelectedProducts(
    filterByExternalId
      ? { organization_id: organization.id, external_id: selectedValues }
      : { id: selectedValues },
    { includeArchived: true, includeAllVersions: true },
  )
  const listedProducts = queriedProducts?.items ?? []
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
    options: (filterByExternalId ? latestVersions(products) : products).flatMap(
      ({ id, external_id: externalId, name, is_archived: isArchived }) => {
        const value = filterByExternalId ? externalId : id
        return value
          ? [{ value, label: `${name}${isArchived ? ' (Archived)' : ''}` }]
          : []
      },
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
  }
}
