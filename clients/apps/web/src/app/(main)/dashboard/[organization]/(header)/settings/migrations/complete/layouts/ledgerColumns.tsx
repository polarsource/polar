import { formatCurrency } from '@polar-sh/currency'
import { DataTableColumnDef, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { KIND_LABELS } from '../completeCopy'
import { MappingRow } from '../idMapping'
import { CopyableId, MappingStatus, PolarIdCell } from '../mappingColumns'

const formatAmount = formatCurrency('accounting', 'en-US')
const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const dateLabel = (row: MappingRow): string | null => {
  if (row.switchedAt)
    return `Switched ${shortDate.format(new Date(row.switchedAt))}`
  if (row.record.renews_at)
    return `Renews ${shortDate.format(new Date(row.record.renews_at))}`
  return null
}

export function buildLedgerColumns(
  organizationSlug: string,
): DataTableColumnDef<MappingRow>[] {
  return [
    {
      id: 'type',
      size: 88,
      header: 'Type',
      cell: ({ row }) => (
        <Text variant="caption" color="muted">
          {KIND_LABELS[row.original.kind]}
        </Text>
      ),
    },
    {
      id: 'name',
      size: 190,
      header: 'Name',
      cell: ({ row }) => (
        <Box flexDirection="column" minWidth={0}>
          <Text variant="caption" truncate>
            {row.original.label}
          </Text>
          {row.original.detail && (
            <Text variant="caption" color="muted" truncate>
              {row.original.detail}
            </Text>
          )}
        </Box>
      ),
    },
    {
      id: 'stripe',
      size: 210,
      header: 'Stripe ID',
      cell: ({ row }) => <CopyableId value={row.original.stripeId} />,
    },
    {
      id: 'polar',
      size: 280,
      header: 'Polar ID',
      cell: ({ row }) => (
        <PolarIdCell row={row.original} organizationSlug={organizationSlug} />
      ),
    },
    {
      id: 'details',
      size: 130,
      header: 'Details',
      cell: ({ row }) => {
        const { amount, currency } = row.original.record
        const date = dateLabel(row.original)
        return (
          <Box flexDirection="column" minWidth={0}>
            {amount != null && currency && (
              <Text variant="caption" monospace tabularNums>
                {formatAmount(amount, currency)}
              </Text>
            )}
            <Text variant="caption" color="muted" truncate>
              {date ?? (amount == null ? '—' : '')}
            </Text>
          </Box>
        )
      },
    },
    {
      id: 'status',
      size: 120,
      header: 'Status',
      cell: ({ row }) => <MappingStatus row={row.original} />,
    },
  ]
}
