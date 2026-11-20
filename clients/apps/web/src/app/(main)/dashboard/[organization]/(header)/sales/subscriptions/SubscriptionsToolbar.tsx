'use client'

import {
  CANCELLATION_REASONS,
  REASON_LABELS,
  type CancellationReason,
} from '@/components/Metrics/cancellations/constants'
import { type Filter } from '@/components/Shared/FilterPopover'
import { type SelectableSubscriptionStatus } from '@/components/Subscriptions/selectableStatuses'
import { type ProductFilter } from '@/components/Products/ProductSelect'
import {
  latestVersions,
  useDiscounts,
  useProducts,
  useSelectedProducts,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  CircleDashed,
  MessageCircle,
  Package,
  TicketPercent,
} from '@polar-sh/orbit/icons'
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
  { value: 'trial_ended', label: 'Trial ended' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'unpaid', label: 'Unpaid' },
]

const REASON_OPTIONS = CANCELLATION_REASONS.map((reason) => ({
  value: reason,
  label: REASON_LABELS[reason],
}))

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
          <Text as="h1" variant="body" wrap="nowrap">
            Subscriptions
          </Text>
          <ToolbarFilterChips
            filters={filters}
            trailing={
              <ToolbarFilterMenu
                filters={filters}
                onReset={hasActiveFilters ? onReset : undefined}
                variant="add"
              />
            }
          />
        </Box>
        <Box alignItems="center" gap="s" flexShrink={0} minHeight={32}>
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
