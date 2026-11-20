'use client'

import FilterPopover, { type Filter } from '@/components/Shared/FilterPopover'
import {
  DEFAULT_GANTT_GROUP,
  type GanttGroup,
} from '@/components/Subscriptions/Gantt/scale'
import { type SubscriptionStatusFilter } from '@/components/Subscriptions/SubscriptionStatusSelect'
import { type ProductFilter } from '@/components/Subscriptions/SubscriptionsProductSelect'
import {
  latestVersions,
  subscriptionCountKeys,
  useProducts,
  useSelectedProducts,
  type SubscriptionCountKey,
} from '@/hooks/queries'
import { DataTableSortingState } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import {
  Button,
  SegmentedControl,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  ChartNoAxesGantt,
  FileDownloadOutlined,
  FunnelX,
  Rows3,
} from '@polar-sh/orbit/icons'
import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { ToolbarMultiSelect } from './ToolbarMultiSelect'
import { ToolbarSelect } from './ToolbarSelect'

// The toolbar never wraps. Below this width of its own container, the status
// tabs and the dropdowns collapse into a single filter popover.
const WIDE_ONLY_CLASS = 'hidden @[1460px]:flex'
const NARROW_ONLY_CLASS = 'flex @[1460px]:hidden'

const STATUS_LABELS: Record<SubscriptionCountKey, string> = {
  any: 'All',
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past due',
  canceling: 'Canceling',
  paused: 'Paused',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
}

const GROUP_OPTIONS: { value: GanttGroup; label: string }[] = [
  { value: 'customer', label: 'By customer' },
  { value: 'total', label: 'Totals' },
  { value: 'product', label: 'By product' },
  { value: 'interval', label: 'By interval' },
]

export const subscriptionViewValues = ['timeline', 'table'] as const
type SubscriptionView = (typeof subscriptionViewValues)[number]

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

const IconAction = ({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 [&_svg]:size-4!"
        onClick={onClick}
        aria-label={label}
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

interface SubscriptionsToolbarProps {
  organization: schemas['Organization']
  product: ProductFilter
  onProductSelect: (product: ProductFilter) => void
  status: SubscriptionStatusFilter
  cancelAtPeriodEnd: boolean | null
  onStatusSelect: (
    status: SubscriptionStatusFilter,
    cancelAtPeriodEnd: boolean | null,
  ) => void
  sorting: DataTableSortingState
  onSortingChange: (sorting: DataTableSortingState) => void
  view: SubscriptionView
  onViewChange: (view: SubscriptionView) => void
  group: GanttGroup
  onGroupChange: (group: GanttGroup) => void
  hasActiveFilters: boolean
  onReset: () => void
  onExport: () => void
}

export const SubscriptionsToolbar = ({
  organization,
  product,
  onProductSelect,
  status,
  cancelAtPeriodEnd,
  onStatusSelect,
  sorting,
  onSortingChange,
  view,
  onViewChange,
  group,
  onGroupChange,
  hasActiveFilters,
  onReset,
  onExport,
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

  const statusValue: SubscriptionCountKey =
    status === 'active' && cancelAtPeriodEnd ? 'canceling' : status
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
  const selectStatus = (key: SubscriptionCountKey) =>
    key === 'canceling'
      ? onStatusSelect('active', true)
      : onStatusSelect(key, null)
  const sortValue = sort ? `${sort.desc ? '-' : ''}${sort.id}` : ''
  const selectSort = (value: string) =>
    onSortingChange([
      { id: value.replace(/^-/, ''), desc: value.startsWith('-') },
    ])

  // One popover holds every filter when the toolbar is too narrow for them.
  const condensedFilters: Filter[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'single',
      options: subscriptionCountKeys
        .filter((key) => key !== 'any')
        .map((key) => ({
          value: key,
          label: STATUS_LABELS[key],
        })),
      value: statusValue === 'any' ? null : statusValue,
      onChange: (value) =>
        selectStatus((value ?? 'any') as SubscriptionCountKey),
    },
    {
      key: 'product',
      label: 'Product',
      type: 'multi',
      options: productOptions,
      value: selectedValues,
      onChange: selectProducts,
    },
    ...(isGroupable
      ? [
          {
            key: 'group',
            label: 'Group',
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
        <Box alignItems="center" columnGap="xl" minWidth={0}>
          <Text as="h1" variant="body" wrap="nowrap">
            Subscriptions
          </Text>
          <div className={WIDE_ONLY_CLASS}>
            <SegmentedControl
              size="sm"
              options={subscriptionCountKeys.map((key) => ({
                value: key,
                label: STATUS_LABELS[key],
              }))}
              value={statusValue}
              onChange={selectStatus}
            />
          </div>
        </Box>
        <Box alignItems="center" gap="s" flexShrink={0} minHeight={32}>
          <div className={twMerge(WIDE_ONLY_CLASS, 'items-center gap-2')}>
            <ToolbarMultiSelect
              label="Product"
              emptyLabel="All products"
              manyLabel="products"
              value={selectedValues}
              options={productOptions}
              onChange={selectProducts}
            />
            {isGroupable && (
              <ToolbarSelect
                label="Group"
                showLabel={false}
                value={group}
                options={GROUP_OPTIONS}
                onChange={onGroupChange}
              />
            )}
            {isSortable && (
              <ToolbarSelect
                label="Sort"
                showLabel={false}
                value={sortValue}
                options={SORT_OPTIONS}
                onChange={selectSort}
              />
            )}
          </div>
          <div className={NARROW_ONLY_CLASS}>
            <FilterPopover filters={condensedFilters} variant="icon" />
          </div>
          <SegmentedControl
            size="sm"
            options={VIEW_OPTIONS}
            value={view}
            onChange={onViewChange}
          />
          <Box alignItems="center" gap="s">
            {hasActiveFilters && (
              <IconAction label="Reset filters" onClick={onReset}>
                <FunnelX />
              </IconAction>
            )}
            <IconAction label="Export" onClick={onExport}>
              <FileDownloadOutlined fontSize="inherit" />
            </IconAction>
          </Box>
        </Box>
      </Box>
    </div>
  )
}
