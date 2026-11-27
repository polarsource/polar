'use client'

import {
  CANCELLATION_REASONS,
  REASON_LABELS,
  type CancellationReason,
} from '@/components/Metrics/cancellations/constants'
import {
  type Filter,
  type FilterOption,
} from '@/components/Shared/FilterPopover'
import { StatusIcon } from '@/components/Shared/StatusIcon'
import {
  getSubscriptionStatusIcon,
  WINDING_DOWN_ICON,
} from '@/components/Subscriptions/SubscriptionStatusIcon'
import { subscriptionStatusDisplayNames } from '@/components/Subscriptions/utils'
import {
  DEFAULT_GANTT_GROUP,
  type GanttGroup,
} from '@/components/Subscriptions/Gantt/scale'
import { type SelectableSubscriptionStatus } from '@/components/Subscriptions/selectableStatuses'
import { type ProductFilter } from '@/components/Products/ProductSelect'
import { DataTableSortingState } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import { SegmentedControl } from '@polar-sh/orbit'
import {
  ChartNoAxesGantt,
  ChevronsUpDown,
  CircleDashed,
  MessageCircle,
  Rows3,
} from '@polar-sh/orbit/icons'
import { type ReactNode } from 'react'
import { type DateRange } from '@/components/Metrics/DateRangePicker'
import { Toolbar } from '@/components/Shared/Toolbar/Toolbar'
import { type ToolbarAction } from '@/components/Shared/Toolbar/ToolbarActionsMenu'
import { useDateRangeFilter } from '@/components/Shared/Toolbar/useDateRangeFilter'
import { useProductFilter } from '@/components/Shared/Toolbar/useProductFilter'
import { useCustomerFilter } from '@/components/Shared/Toolbar/useCustomerFilter'
import { ToolbarSearch } from '@/components/Shared/Toolbar/ToolbarSearch'
import { useDiscountFilter } from './useDiscountFilter'
import { type SubscriptionView } from './useSubscriptionsView'

type StatusOption = SelectableSubscriptionStatus | 'canceling'

const STATUS_OPTIONS: FilterOption[] = (
  [
    'active',
    'trialing',
    'past_due',
    'canceling',
    'paused',
    'trial_ended',
    'canceled',
    'unpaid',
  ] satisfies StatusOption[]
).map((value) => ({
  value,
  label:
    value === 'canceling' ? 'Canceling' : subscriptionStatusDisplayNames[value],
  icon: (
    <StatusIcon
      {...(value === 'canceling'
        ? WINDING_DOWN_ICON
        : getSubscriptionStatusIcon(value))}
    />
  ),
}))

const CANCELING_STATUSES: SelectableSubscriptionStatus[] = [
  'active',
  'trialing',
]

const REASON_OPTIONS = CANCELLATION_REASONS.map((reason) => ({
  value: reason,
  label: REASON_LABELS[reason],
}))

const GROUP_OPTIONS: { value: GanttGroup; label: string }[] = [
  { value: 'customer', label: 'By customer' },
  { value: 'total', label: 'Totals' },
  { value: 'product', label: 'By product' },
  { value: 'interval', label: 'By interval' },
]

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
  started: DateRange | null
  onStartedSelect: (value: DateRange | null) => void
  query: string | null
  onQuerySelect: (value: string | null) => void
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
  started,
  onStartedSelect,
  query,
  onQuerySelect,
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
  const productFilter = useProductFilter(
    organization,
    product,
    onProductSelect,
    { recurringOnly: true },
  )
  const startedFilter = useDateRangeFilter(
    organization,
    started,
    onStartedSelect,
    { key: 'started', label: 'Started' },
  )
  const discountFilter = useDiscountFilter(
    organization.id,
    discountId,
    onDiscountSelect,
  )

  const statusValue: StatusOption[] = cancelAtPeriodEnd
    ? ['canceling']
    : (status ?? [])
  // Canceling is subscriptions still running but set to end. "Set to end"
  // applies to every status asked for, so picking it replaces the selection.
  const selectStatus = (value: StatusOption[]) => {
    if (value.includes('canceling') && !cancelAtPeriodEnd) {
      onStatusSelect(CANCELING_STATUSES, true)
      return
    }
    const statuses = value.filter(
      (option): option is SelectableSubscriptionStatus =>
        option !== 'canceling',
    )
    onStatusSelect(statuses.length > 0 ? statuses : null, null)
  }
  // The table sorts from its headers and always lists subscriptions, so
  // grouping and the sort option only apply to the timeline.
  const isTimeline = view === 'timeline'
  const [sort] = sorting
  // The table can sort by columns this menu does not list. Those read as unset.
  const sortId = sort ? `${sort.desc ? '-' : ''}${sort.id}` : null
  const sortValue = SORT_OPTIONS.some(({ value }) => value === sortId)
    ? sortId
    : null
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
    productFilter,
    customerFilter,
    discountFilter,
    startedFilter,
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
    ...(isTimeline
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
    ...(isTimeline && group === 'customer'
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
    <Toolbar
      title="Subscriptions"
      filters={filters}
      onReset={hasActiveFilters ? onReset : undefined}
      actions={actions}
    >
      <ToolbarSearch
        value={query}
        onChange={onQuerySelect}
        placeholder="Search subscriptions"
      />
      <SegmentedControl
        size="sm"
        options={VIEW_OPTIONS}
        value={view}
        onChange={onViewChange}
      />
    </Toolbar>
  )
}
