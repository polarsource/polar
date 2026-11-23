import {
  type AggregateBucket,
  type AggregateRow,
} from '@/utils/subscriptionAggregate'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const plural = (count: number, noun: string) =>
  `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`

interface AggregateRowLabelProps {
  row: AggregateRow
  height: number
  bucket: AggregateBucket | undefined
  periodLabel: string | null
  onSelect?: () => void
}

export const AggregateRowLabel = ({
  row,
  height,
  bucket,
  periodLabel,
  onSelect,
}: AggregateRowLabelProps) => {
  const format = (amount: number) =>
    formatCurrency('compact')(amount, row.currency)
  return (
    <Box
      height={height}
      flexShrink={0}
      alignItems="start"
      columnGap="m"
      py="m"
      px="l"
      cursor={onSelect ? 'pointer' : undefined}
      onClick={onSelect}
    >
      <Box flexDirection="column" flex={1} minWidth={0}>
        <Text truncate>{row.label}</Text>
        <Text color="muted" truncate>
          {periodLabel ??
            `${plural(row.subscriptions, 'subscription')} · ${format(row.monthlyAmount)} MRR`}
        </Text>
        {bucket && (
          <Text color="muted" truncate tabularNums>
            {plural(bucket.renewals, 'renewal')} ·{' '}
            {format(bucket.renewingAmount)}
          </Text>
        )}
        {bucket && bucket.atRisk > 0 && (
          <Text color="muted" truncate tabularNums>
            {bucket.atRisk.toLocaleString('en-US')} lost or at risk ·{' '}
            {format(bucket.atRiskAmount)}
          </Text>
        )}
      </Box>
    </Box>
  )
}
