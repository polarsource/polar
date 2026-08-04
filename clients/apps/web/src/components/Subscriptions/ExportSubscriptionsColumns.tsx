'use client'

import { ChipSelect } from '@/components/Form/ChipSelect'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export type ExportColumn = schemas['SubscriptionExportColumn']

const EXPORT_COLUMN_GROUPS = [
  {
    label: 'Subscription',
    columns: [
      { value: 'started_at', label: 'Started At' },
      { value: 'status', label: 'Status' },
      { value: 'recurring_interval', label: 'Billing Interval' },
      { value: 'current_period_start', label: 'Current Period Start' },
      { value: 'current_period_end', label: 'Current Period End' },
      { value: 'seats', label: 'Seats' },
      { value: 'trial_start', label: 'Trial Start' },
      { value: 'trial_end', label: 'Trial End' },
    ],
  },
  {
    label: 'Cancellation',
    columns: [
      { value: 'cancel_at_period_end', label: 'Cancels At Period End' },
      { value: 'canceled_at', label: 'Canceled At' },
      { value: 'ends_at', label: 'Ends At' },
      { value: 'ended_at', label: 'Ended At' },
      { value: 'cancellation_reason', label: 'Cancellation Reason' },
    ],
  },
  {
    label: 'Customer',
    columns: [
      { value: 'email', label: 'Email' },
      { value: 'customer_name', label: 'Customer Name' },
      { value: 'billing_name', label: 'Billing Name' },
      { value: 'billing_country', label: 'Billing Country' },
    ],
  },
  {
    label: 'Product & Amounts',
    columns: [
      { value: 'product', label: 'Product' },
      { value: 'amount', label: 'Amount' },
      { value: 'currency', label: 'Currency' },
      { value: 'discount', label: 'Discount' },
      { value: 'net_amount', label: 'Net Amount' },
    ],
  },
] as const satisfies {
  readonly label: string
  readonly columns: readonly { value: ExportColumn; label: string }[]
}[]

export const ALL_EXPORT_COLUMNS: ExportColumn[] = EXPORT_COLUMN_GROUPS.flatMap(
  (group) => group.columns.map((column) => column.value),
)

const EXPORT_COLUMN_LABELS = Object.fromEntries(
  EXPORT_COLUMN_GROUPS.flatMap((group) =>
    group.columns.map((column) => [column.value, column.label]),
  ),
) as Record<ExportColumn, string>

export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  'email',
  'started_at',
  'product',
  'amount',
  'currency',
  'status',
  'recurring_interval',
]

export const sortExportColumns = (selected: ExportColumn[]): ExportColumn[] =>
  ALL_EXPORT_COLUMNS.filter((column) => selected.includes(column))

const isDefaultExportColumnSet = (selected: ExportColumn[]): boolean =>
  selected.length === DEFAULT_EXPORT_COLUMNS.length &&
  DEFAULT_EXPORT_COLUMNS.every((column) => selected.includes(column))

export const summarizeExportColumns = (selected: ExportColumn[]): string => {
  if (selected.length === 0) return 'No fields selected'
  if (selected.length === ALL_EXPORT_COLUMNS.length) return 'All fields'
  const ordered = sortExportColumns(selected)
  const shown = ordered
    .slice(0, 3)
    .map((c) => EXPORT_COLUMN_LABELS[c])
    .join(', ')
  return ordered.length > 3 ? `${shown} +${ordered.length - 3}` : shown
}

interface ExportSubscriptionsColumnsProps {
  selected: ExportColumn[]
  onChange: (columns: ExportColumn[]) => void
}

const ExportSubscriptionsColumns: React.FC<ExportSubscriptionsColumnsProps> = ({
  selected,
  onChange,
}) => {
  const allSelected = selected.length === ALL_EXPORT_COLUMNS.length
  const isDefault = isDefaultExportColumnSet(selected)

  return (
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="center" justifyContent="between" columnGap="l">
        <Text variant="caption" color="muted">
          {selected.length} of {ALL_EXPORT_COLUMNS.length} selected
        </Text>
        <Box alignItems="center" columnGap="xs">
          {!isDefault && (
            <Button
              variant="ghost"
              size="sm"
              className="dark:text-polar-500 dark:hover:text-polar-300 h-7 px-2 text-xs font-normal text-gray-500 hover:text-gray-900"
              onClick={() => onChange(DEFAULT_EXPORT_COLUMNS)}
            >
              Reset
            </Button>
          )}
          {!allSelected && (
            <Button
              variant="ghost"
              size="sm"
              className="dark:text-polar-500 dark:hover:text-polar-300 h-7 px-2 text-xs font-normal text-gray-500 hover:text-gray-900"
              onClick={() => onChange(ALL_EXPORT_COLUMNS)}
            >
              Select all
            </Button>
          )}
        </Box>
      </Box>

      {EXPORT_COLUMN_GROUPS.map((group) => {
        const groupValues: ExportColumn[] = group.columns.map(
          (column) => column.value,
        )
        return (
          <Box key={group.label} flexDirection="column" rowGap="s">
            <Text variant="label" color="muted">
              {group.label}
            </Text>
            <ChipSelect
              options={[...group.columns]}
              selected={selected.filter((column) =>
                groupValues.includes(column),
              )}
              onChange={(next) =>
                onChange([
                  ...selected.filter((column) => !groupValues.includes(column)),
                  ...(next as ExportColumn[]),
                ])
              }
            />
          </Box>
        )
      })}
    </Box>
  )
}

export default ExportSubscriptionsColumns
