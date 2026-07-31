'use client'

import { ChipSelect } from '@/components/Form/ChipSelect'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export type ExportColumn = schemas['OrderExportColumn']

const EXPORT_COLUMN_GROUPS = [
  {
    label: 'Order',
    columns: [
      { value: 'created_at', label: 'Created At' },
      { value: 'product', label: 'Product' },
      { value: 'status', label: 'Status' },
      { value: 'billing_reason', label: 'Billing Reason' },
      { value: 'invoice_number', label: 'Invoice number' },
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
    label: 'Amounts',
    columns: [
      { value: 'amount', label: 'Net Amount' },
      { value: 'currency', label: 'Currency' },
      { value: 'subtotal_amount', label: 'Subtotal' },
      { value: 'discount_amount', label: 'Discount' },
      { value: 'tax_amount', label: 'Tax' },
      { value: 'total_amount', label: 'Total' },
      { value: 'refunded_amount', label: 'Refunded Amount' },
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
  'created_at',
  'product',
  'amount',
  'currency',
  'status',
  'invoice_number',
]

export const orderExportColumns = (selected: ExportColumn[]): ExportColumn[] =>
  ALL_EXPORT_COLUMNS.filter((column) => selected.includes(column))

const isDefaultExportColumnSet = (selected: ExportColumn[]): boolean =>
  selected.length === DEFAULT_EXPORT_COLUMNS.length &&
  DEFAULT_EXPORT_COLUMNS.every((column) => selected.includes(column))

export const summarizeExportColumns = (selected: ExportColumn[]): string => {
  if (selected.length === 0) return 'No fields selected'
  if (selected.length === ALL_EXPORT_COLUMNS.length) return 'All fields'
  const ordered = orderExportColumns(selected)
  const shown = ordered
    .slice(0, 3)
    .map((c) => EXPORT_COLUMN_LABELS[c])
    .join(', ')
  return ordered.length > 3 ? `${shown} +${ordered.length - 3}` : shown
}

interface ExportOrdersColumnsProps {
  selected: ExportColumn[]
  onChange: (columns: ExportColumn[]) => void
}

const ExportOrdersColumns: React.FC<ExportOrdersColumnsProps> = ({
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

export default ExportOrdersColumns
