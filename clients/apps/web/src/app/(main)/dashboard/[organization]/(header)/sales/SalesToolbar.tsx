'use client'

import { type DateRange } from '@/components/Metrics/DateRangePicker'
import { orderStatusOptions } from '@/components/Orders/OrderStatus'
import { type ProductFilter } from '@/components/Products/ProductSelect'
import {
  isFilterActive,
  isFilterDefaulted,
  type Filter,
} from '@/components/Shared/FilterPopover'
import { Toolbar } from '@/components/Shared/Toolbar/Toolbar'
import { type ToolbarAction } from '@/components/Shared/Toolbar/ToolbarActionsMenu'
import { useDateRangeFilter } from '@/components/Shared/Toolbar/useDateRangeFilter'
import { useProductFilter } from '@/components/Shared/Toolbar/useProductFilter'
import { ToolbarSearch } from '@/components/Shared/Toolbar/ToolbarSearch'
import { schemas } from '@polar-sh/client'
import { CircleDashed } from '@polar-sh/orbit/icons'

type OrderStatus = schemas['OrderStatus']

interface SalesToolbarProps {
  organization: schemas['Organization']
  product: ProductFilter
  onProductSelect: (product: ProductFilter) => void
  status: OrderStatus[] | null
  onStatusSelect: (status: OrderStatus[] | null) => void
  query: string | null
  onQuerySelect: (value: string | null) => void
  dateRange: DateRange
  onDateRangeSelect: (range: DateRange | null) => void
  actions: ToolbarAction[][]
}

export const SalesToolbar = ({
  organization,
  product,
  onProductSelect,
  status,
  onStatusSelect,
  query,
  onQuerySelect,
  dateRange,
  onDateRangeSelect,
  actions,
}: SalesToolbarProps) => {
  const productFilter = useProductFilter(organization, product, onProductSelect)
  const dateFilter = useDateRangeFilter(
    organization,
    dateRange,
    onDateRangeSelect,
  )
  const filters: Filter[] = [
    {
      key: 'status',
      label: 'Status',
      icon: <CircleDashed className="size-4" />,
      type: 'multi',
      options: orderStatusOptions,
      value: status ?? [],
      onChange: (value) =>
        onStatusSelect(value.length > 0 ? (value as OrderStatus[]) : null),
    },
    productFilter,
    dateFilter,
  ]
  const hasActiveFilters = filters.some(
    (filter) => isFilterActive(filter) && !isFilterDefaulted(filter),
  )
  const reset = () => {
    onStatusSelect(null)
    onProductSelect({ product_id: null, external_product_id: null })
    onDateRangeSelect(null)
  }

  return (
    <Toolbar
      title="Orders"
      filters={filters}
      onReset={hasActiveFilters ? reset : undefined}
      actions={actions}
    >
      <ToolbarSearch
        value={query}
        onChange={onQuerySelect}
        placeholder="Search orders"
      />
    </Toolbar>
  )
}
