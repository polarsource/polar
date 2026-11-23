'use client'

import {
  CANCELLATION_REASONS,
  REASON_LABELS,
  type CancellationReason,
} from '@/components/Metrics/cancellations/constants'
import { type Filter } from '@/components/Shared/FilterPopover'
import { type SelectableSubscriptionStatus } from '@/components/Subscriptions/selectableStatuses'
import { type ProductFilter } from '@/components/Products/ProductSelect'
import { useDiscounts } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  CircleDashed,
  MessageCircle,
  TicketPercent,
} from '@polar-sh/orbit/icons'
import { ToolbarActionsMenu, type ToolbarAction } from './ToolbarActionsMenu'
import { ToolbarFilterChips } from './ToolbarFilterChips'
import { ToolbarFilterMenu } from './ToolbarFilterMenu'
import { useCustomerFilter } from './useCustomerFilter'
import { useProductFilter } from './useProductFilter'

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

const CANCELING_STATUSES: SelectableSubscriptionStatus[] = [
  'active',
  'trialing',
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
  const productFilter = useProductFilter(organization, product, onProductSelect)
  const { data: discounts } = useDiscounts(organization.id, { limit: 100 })

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
