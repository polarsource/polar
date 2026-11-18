'use client'

import {
  ganttZoomValues,
  type GanttZoom,
} from '@/components/Subscriptions/Gantt/scale'
import { type FilterOption } from '@/components/Shared/FilterPopover'
import SubscriptionCancellationSelect from '@/components/Subscriptions/SubscriptionCancellationSelect'
import SubscriptionStatusSelect, {
  type SubscriptionStatusFilter,
} from '@/components/Subscriptions/SubscriptionStatusSelect'
import SubscriptionsProductSelect, {
  type ProductFilter,
} from '@/components/Subscriptions/SubscriptionsProductSelect'
import {
  latestVersions,
  useProducts,
  useSelectedProducts,
} from '@/hooks/queries'
import { DataTableSortingState } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import {
  Button,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { FileDownloadOutlined, FunnelX } from '@polar-sh/orbit/icons'
import { ReactNode } from 'react'

const SORT_OPTIONS = [
  { value: '-started_at', label: 'Newest' },
  { value: 'started_at', label: 'Oldest' },
  { value: 'current_period_end', label: 'Next renewal' },
  { value: 'customer', label: 'Customer' },
  { value: 'product', label: 'Product' },
  { value: '-amount', label: 'Highest amount' },
] as const

const ZOOM_OPTIONS = ganttZoomValues.map((value) => ({ value, label: value }))

const HeaderAction = ({
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

const FilterSection = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <Box flexDirection="column" gap="s">
    <h3 className="text-sm">{title}</h3>
    {children}
  </Box>
)

interface SubscriptionsSidebarProps {
  organization: schemas['Organization']
  count: number | undefined
  product: ProductFilter
  onProductSelect: (product: ProductFilter) => void
  status: SubscriptionStatusFilter
  onStatusSelect: (value: SubscriptionStatusFilter) => void
  cancelAtPeriodEnd: boolean | null
  onCancelAtPeriodEndSelect: (value: boolean | null) => void
  sorting: DataTableSortingState
  onSortingChange: (sorting: DataTableSortingState) => void
  zoom: GanttZoom
  onZoomChange: (zoom: GanttZoom) => void
  hasActiveFilters: boolean
  onReset: () => void
  onExport: () => void
}

export const SubscriptionsSidebar = ({
  organization,
  count,
  product,
  onProductSelect,
  status,
  onStatusSelect,
  cancelAtPeriodEnd,
  onCancelAtPeriodEndSelect,
  sorting,
  onSortingChange,
  zoom,
  onZoomChange,
  hasActiveFilters,
  onReset,
  onExport,
}: SubscriptionsSidebarProps) => {
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
  const selectedValues = productFilter ? [productFilter] : []
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
  ).flatMap<FilterOption>((product) => {
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

  const [sort] = sorting
  const sortValue = sort ? `${sort.desc ? '-' : ''}${sort.id}` : undefined

  return (
    <Box flexDirection="column" height="100%">
      <Box
        alignItems="center"
        justifyContent="between"
        gap="s"
        paddingLeft="l"
        paddingRight="m"
        paddingTop="l"
      >
        <Box alignItems="baseline" gap="s" minWidth={0}>
          <Text as="h1" variant="body">
            Subscriptions
          </Text>
          {count !== undefined && (
            <Text variant="body" color="muted" tabularNums>
              {count.toLocaleString('en-US')}
            </Text>
          )}
        </Box>
        <Box alignItems="center" gap="xs" flexShrink={0}>
          {hasActiveFilters && (
            <HeaderAction label="Reset filters" onClick={onReset}>
              <FunnelX />
            </HeaderAction>
          )}
          <HeaderAction label="Export" onClick={onExport}>
            <FileDownloadOutlined fontSize="inherit" />
          </HeaderAction>
        </Box>
      </Box>
      <Box
        flexDirection="column"
        flexGrow={1}
        gap="xl"
        overflowY="auto"
        paddingHorizontal="l"
        paddingVertical="l"
      >
        <FilterSection title="Zoom">
          <SegmentedControl
            variant="tabs"
            options={ZOOM_OPTIONS}
            value={zoom}
            onChange={onZoomChange}
          />
        </FilterSection>
        <FilterSection title="Status">
          <SubscriptionStatusSelect value={status} onChange={onStatusSelect} />
          {status === 'active' && (
            <SubscriptionCancellationSelect
              value={cancelAtPeriodEnd}
              onChange={onCancelAtPeriodEndSelect}
            />
          )}
        </FilterSection>
        <FilterSection title="Product">
          <SubscriptionsProductSelect
            options={productOptions}
            value={productFilter}
            onChange={(value) =>
              onProductSelect(
                filterByExternalId
                  ? { product_id: null, external_product_id: value }
                  : { product_id: value, external_product_id: null },
              )
            }
          />
        </FilterSection>
        <FilterSection title="Sorting">
          <Select
            value={sortValue}
            onValueChange={(value) =>
              onSortingChange([
                { id: value.replace(/^-/, ''), desc: value.startsWith('-') },
              ])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterSection>
      </Box>
    </Box>
  )
}
