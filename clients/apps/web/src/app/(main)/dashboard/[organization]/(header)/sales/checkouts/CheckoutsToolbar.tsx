'use client'

import { type DateRange } from '@/components/Metrics/DateRangePicker'
import { type ProductFilter } from '@/components/Products/ProductSelect'
import {
  isFilterActive,
  isFilterDefaulted,
  type Filter,
} from '@/components/Shared/FilterPopover'
import { Toolbar } from '@/components/Shared/Toolbar/Toolbar'
import { type ToolbarAction } from '@/components/Shared/Toolbar/ToolbarActionsMenu'
import { useCustomerFilter } from '@/components/Shared/Toolbar/useCustomerFilter'
import { useDateRangeFilter } from '@/components/Shared/Toolbar/useDateRangeFilter'
import { useProductFilter } from '@/components/Shared/Toolbar/useProductFilter'
import { useSearchFilter } from '@/components/Shared/Toolbar/useSearchFilter'
import { checkoutStatusOptions } from '@/components/Checkouts/CheckoutStatus'
import { schemas } from '@polar-sh/client'
import { CircleDashed } from '@polar-sh/orbit/icons'

type CheckoutStatus = schemas['CheckoutStatus']

interface CheckoutsToolbarProps {
  organization: schemas['Organization']
  product: ProductFilter
  onProductSelect: (product: ProductFilter) => void
  status: CheckoutStatus[] | null
  onStatusSelect: (status: CheckoutStatus[] | null) => void
  customerId: string[] | null
  onCustomerSelect: (value: string[] | null) => void
  query: string | null
  onQuerySelect: (value: string | null) => void
  created: DateRange | null
  onCreatedSelect: (range: DateRange | null) => void
  actions: ToolbarAction[][]
}

export const CheckoutsToolbar = ({
  organization,
  product,
  onProductSelect,
  status,
  onStatusSelect,
  customerId,
  onCustomerSelect,
  query,
  onQuerySelect,
  created,
  onCreatedSelect,
  actions,
}: CheckoutsToolbarProps) => {
  const productFilter = useProductFilter(organization, product, onProductSelect)
  const customerFilter = useCustomerFilter(
    organization.id,
    customerId,
    onCustomerSelect,
  )
  const dateFilter = useDateRangeFilter(organization, created, onCreatedSelect)
  // A checkout can have a name and email before it has a customer, so this
  // finds the ones the customer filter cannot.
  const searchFilter = useSearchFilter(
    query,
    onQuerySelect,
    'Name or email contains...',
  )
  const filters: Filter[] = [
    {
      key: 'status',
      label: 'Status',
      icon: <CircleDashed className="size-4" />,
      type: 'multi',
      options: checkoutStatusOptions,
      value: status ?? [],
      onChange: (value) =>
        onStatusSelect(value.length > 0 ? (value as CheckoutStatus[]) : null),
    },
    productFilter,
    customerFilter,
    searchFilter,
    dateFilter,
  ]
  const hasActiveFilters = filters.some(
    (filter) => isFilterActive(filter) && !isFilterDefaulted(filter),
  )
  const reset = () => {
    onStatusSelect(null)
    onProductSelect({ product_id: null, external_product_id: null })
    onCustomerSelect(null)
    onQuerySelect(null)
    onCreatedSelect(null)
  }

  return (
    <Toolbar
      title="Checkouts"
      filters={filters}
      onReset={hasActiveFilters ? reset : undefined}
      actions={actions}
    />
  )
}
