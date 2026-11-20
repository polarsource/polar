'use client'

import {
  CANCELLATION_REASONS,
  REASON_LABELS,
  type CancellationReason,
} from '@/components/Metrics/cancellations/constants'
import { type Filter } from '@/components/Shared/FilterPopover'
import {
  DEFAULT_GANTT_GROUP,
  type GanttGroup,
} from '@/components/Subscriptions/Gantt/scale'
import { type SelectableSubscriptionStatus } from '@/components/Subscriptions/SubscriptionStatusSelect'
import { type ProductFilter } from '@/components/Subscriptions/SubscriptionsProductSelect'
import {
  latestVersions,
  useDiscounts,
  useProducts,
  useSelectedProducts,
} from '@/hooks/queries'
import { DataTableSortingState } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import { SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  ChartNoAxesGantt,
  ChevronsUpDown,
  CircleDashed,
  MessageCircle,
  Package,
  Rows3,
  TicketPercent,
} from '@polar-sh/orbit/icons'
import { ReactNode } from 'react'
import { ToolbarActionsMenu, type ToolbarAction } from './ToolbarActionsMenu'
import { ToolbarFilterChips } from './ToolbarFilterChips'
import { ToolbarFilterMenu } from './ToolbarFilterMenu'
import { useCustomerFilter } from './useCustomerFilter'

type StatusOption = SelectableSubscriptionStatus | 'canceling'

const STATUS_OPTIONS: { value: StatusOption; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'past_due', label: 'Past due' },
  { value: 'canceling', label: 'Canceling' },
  { value: 'paused', label: 'Paused' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'unpaid', label: 'Unpaid' },
]

const REASON_OPTIONS = CANCELLATION_REASONS.map((reason) => ({
  value: reason,
  label: REASON_LABELS[reason],
}))

const COUNT_FORMAT = new Intl.NumberFormat('en-US')

const GROUP_OPTIONS: { value: GanttGroup; label: string }[] = [
  { value: 'customer', label: 'By customer' },
  { value: 'total', label: 'Totals' },
  { value: 'product', label: 'By product' },
  { value: 'interval', label: 'By interval' },
]

export const subscriptionViewValues = ['timeline', 'table'] as const
export type SubscriptionView = (typeof subscriptionViewValues)[number]

const VIEW_OPTIONS: { value: SubscriptionView; label: ReactNode }[] = [
  {
    value: 'timeline',
    label: <ChartNoAxesGantt className="size-4" aria-label="Timeline" />,
  },
  { value: 'table', label: <Rows3 className="size-4" aria-label="Table" /> },
]

const SORT_OPTIONS = [
  { value: '-started_at', label: 'Newest' },
  { value: 'started_at', label: 'Oldest' },
  { value: 'current_period_end', label: 'Next renewal' },
  { value: 'customer', label: 'Customer' },
  { value: 'product', label: 'Product' },
  { value: '-amount', label: 'Highest amount' },
]

interface SubscriptionsToolbarProps {
  organization: schemas['Organization']
  // How many subscriptions match the filters, as the list reports it.
  totalCount?: number
  product: ProductFilter
  onProductSelect: (product: ProductFilter) => void
  status: SelectableSubscriptionStatus[] | null
  cancelAtPeriodEnd: boolean | null
  onStatusSelect: (
    status: SelectableSubscriptionStatus[] | null,
    cancelAtPeriodEnd: boolean | null,
  ) => void
  customerId: string[] | null
  onCustomerSelect: (value: string[] | null) => void
  discountId: string[] | null
  onDiscountSelect: (value: string[] | null) => void
  cancellationReason: CancellationReason[] | null
  onCancellationReasonSelect: (value: CancellationReason[] | null) => void
  sorting: DataTableSortingState
  onSortingChange: (sorting: DataTableSortingState) => void
  view: SubscriptionView
  onViewChange: (view: SubscriptionView) => void
  group: GanttGroup
  onGroupChange: (group: GanttGroup) => void
  hasActiveFilters: boolean
  onReset: () => void
  // Shown in the more menu, one list per group.
  actions: ToolbarAction[][]
}

export const SubscriptionsToolbar = ({
  organization,
  totalCount,
  product,
  onProductSelect,
  status,
  cancelAtPeriodEnd,
  onStatusSelect,
  customerId,
  onCustomerSelect,
  discountId,
  onDiscountSelect,
  cancellationReason,
  onCancellationReasonSelect,
  sorting,
  onSortingChange,
  view,
  onViewChange,
  group,
  onGroupChange,
  hasActiveFilters,
  onReset,
  actions,
}: SubscriptionsToolbarProps) => {
  // A product_id link keeps filtering by ID until the selection is cleared
  const filterByExternalId =
    !!organization.feature_settings?.config_as_code_enabled &&
    !product.product_id
  const productFilter = filterByExternalId
    ? product.external_product_id
    : product.product_id

  const { data: queriedProducts } = useProducts(organization.id, {
    is_recurring: true,
    sorting: ['name'],
    limit: 100,
  })
  const selectedValues = productFilter ?? []
  const { data: discounts } = useDiscounts(organization.id, { limit: 100 })
  const { data: selectedProducts } = useSelectedProducts(
    filterByExternalId
      ? { organization_id: organization.id, external_id: selectedValues }
      : { id: selectedValues },
    { includeArchived: true, includeAllVersions: true },
  )
  const listedProducts = queriedProducts?.items ?? []
  const allProducts = [
    ...listedProducts,
    ...(selectedProducts ?? []).filter(
      (selected) => !listedProducts.some(({ id }) => id === selected.id),
    ),
  ]
  const productOptions = (
    filterByExternalId ? latestVersions(allProducts) : allProducts
  ).flatMap((product) => {
    const value = filterByExternalId ? product.external_id : product.id
    return value
      ? [
          {
            value,
            label: `${product.name}${product.is_archived ? ' (Archived)' : ''}`,
          },
        ]
      : []
  })

  const statusValue: StatusOption[] = cancelAtPeriodEnd
    ? ['canceling']
    : (status ?? [])
  const [sort] = sorting
  // The table always lists subscriptions, so grouping only applies to the timeline.
  const isGroupable = view === 'timeline'
  const isSortable = view === 'table' || group === 'customer'

  const selectProducts = (value: string[]) => {
    const selected = value.length > 0 ? value : null
    onProductSelect(
      filterByExternalId
        ? { product_id: null, external_product_id: selected }
        : { product_id: selected, external_product_id: null },
    )
  }
  // Canceling is active subscriptions set to end, which the list cannot
  // combine with other statuses, so picking it replaces the selection.
  const selectStatus = (value: StatusOption[]) => {
    if (value.includes('canceling') && !cancelAtPeriodEnd) {
      onStatusSelect(['active'], true)
      return
    }
    const statuses = value.filter(
      (option): option is SelectableSubscriptionStatus =>
        option !== 'canceling',
    )
    onStatusSelect(statuses.length > 0 ? statuses : null, null)
  }
  const sortValue = sort ? `${sort.desc ? '-' : ''}${sort.id}` : ''
  const selectSort = (value: string) =>
    onSortingChange([
      { id: value.replace(/^-/, ''), desc: value.startsWith('-') },
    ])

  const customerFilter = useCustomerFilter(
    organization.id,
    customerId,
    onCustomerSelect,
  )
  const statusFilter: Filter = {
    key: 'status',
    label: 'Status',
    icon: <CircleDashed className="size-4" />,
    type: 'multi',
    options: STATUS_OPTIONS,
    value: statusValue,
    onChange: (value) => selectStatus(value as StatusOption[]),
  }
  // Everything set from the filter menu. Each one away from its default also
  // shows as a chip under the toolbar.
  const filters: Filter[] = [
    statusFilter,
    {
      key: 'product',
      label: 'Product',
      searchPlaceholder: 'Filter...',
      icon: <Package className="size-4" />,
      type: 'multi',
      options: productOptions,
      value: selectedValues,
      onChange: selectProducts,
    },
    customerFilter,
    {
      key: 'discount',
      label: 'Discount',
      icon: <TicketPercent className="size-4" />,
      type: 'multi',
      options: (discounts?.items ?? []).map(({ id, name }) => ({
        value: id,
        label: name,
      })),
      value: discountId ?? [],
      onChange: (value) => onDiscountSelect(value.length > 0 ? value : null),
    },
    {
      key: 'cancellation_reason',
      label: 'Cancellation reason',
      icon: <MessageCircle className="size-4" />,
      type: 'multi',
      options: REASON_OPTIONS,
      value: cancellationReason ?? [],
      onChange: (value) =>
        onCancellationReasonSelect(
          value.length > 0 ? (value as CancellationReason[]) : null,
        ),
    },
    ...(isGroupable
      ? [
          {
            key: 'group',
            label: 'Group',
            icon: <Rows3 className="size-4" />,
            type: 'single' as const,
            options: GROUP_OPTIONS,
            value: group,
            defaultValue: DEFAULT_GANTT_GROUP,
            onChange: (value: string | null) =>
              onGroupChange((value ?? DEFAULT_GANTT_GROUP) as GanttGroup),
          },
        ]
      : []),
    ...(isSortable
      ? [
          {
            key: 'sort',
            label: 'Sort',
            icon: <ChevronsUpDown className="size-4" />,
            type: 'single' as const,
            options: SORT_OPTIONS,
            value: sortValue,
            defaultValue: SORT_OPTIONS[0].value,
            onChange: (value: string | null) =>
              selectSort(value ?? SORT_OPTIONS[0].value),
          },
        ]
      : []),
  ]

  return (
    <div className="@container">
      <Box
        alignItems="center"
        justifyContent="between"
        gap="l"
        px="l"
        py="m"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box alignItems="center" columnGap="l" minWidth={0}>
          <Box alignItems="baseline" gap="m">
            <Text as="h1" variant="body" wrap="nowrap">
              Subscriptions
            </Text>
            {totalCount !== undefined && (
              <Text variant="body" color="muted" tabularNums>
                {COUNT_FORMAT.format(totalCount)}
              </Text>
            )}
          </Box>
          <ToolbarFilterChips filters={filters} />
        </Box>
        <Box alignItems="center" gap="s" flexShrink={0} minHeight={32}>
          <SegmentedControl
            size="sm"
            options={VIEW_OPTIONS}
            value={view}
            onChange={onViewChange}
          />
          <ToolbarFilterMenu
            filters={filters}
            onReset={hasActiveFilters ? onReset : undefined}
          />
          <ToolbarActionsMenu groups={actions} />
        </Box>
      </Box>
    </div>
  )
}
