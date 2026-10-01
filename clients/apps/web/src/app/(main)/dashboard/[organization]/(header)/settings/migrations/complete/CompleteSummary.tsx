import { schemas } from '@polar-sh/client'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MappingKind, MappingRow } from './idMapping'

const numberFormat = new Intl.NumberFormat('en-US')

interface Stat {
  label: string
  value: number
  hint?: string
  tone?: 'success' | 'warning' | 'danger'
}

const TONE_COLORS = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const

const inPolar = (rows: MappingRow[]) =>
  rows.filter((row) => row.state !== 'not_imported').length

export function completeStats(
  report: schemas['MerchantMigrationCutoverReport'],
  mapping: Record<MappingKind, MappingRow[]>,
): Stat[] {
  return [
    {
      label: 'Billing on Polar',
      value: report.moved,
      hint: 'subscriptions',
      tone: 'success',
    },
    {
      label: 'Left on Stripe',
      value: report.skipped + report.pending,
      hint: 'subscriptions',
      tone: report.skipped + report.pending > 0 ? 'warning' : undefined,
    },
    {
      label: 'Failed',
      value: report.failed,
      hint: 'subscriptions',
      tone: report.failed > 0 ? 'danger' : undefined,
    },
    { label: 'Customers', value: inPolar(mapping.customers), hint: 'in Polar' },
    { label: 'Products', value: inPolar(mapping.products), hint: 'in Polar' },
    { label: 'Discounts', value: inPolar(mapping.discounts), hint: 'in Polar' },
  ]
}

export function StatTile({ stat }: { stat: Stat }) {
  return (
    <Box
      flexDirection="column"
      rowGap="xs"
      padding="l"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-card"
    >
      <Text variant="caption" color="muted">
        {stat.label}
      </Text>
      <Box alignItems="baseline" columnGap="xs">
        <Box color={stat.tone ? TONE_COLORS[stat.tone] : 'text-primary'}>
          <Text variant="heading-xs" tabularNums color="inherit">
            {numberFormat.format(stat.value)}
          </Text>
        </Box>
        {stat.hint && (
          <Text variant="caption" color="muted">
            {stat.hint}
          </Text>
        )}
      </Box>
    </Box>
  )
}

export function CompleteSummary({
  stats,
  columns = 'repeat(3, 1fr)',
}: {
  stats: Stat[]
  columns?: string
}) {
  return (
    <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: columns }} gap="m">
      {stats.map((stat) => (
        <StatTile key={stat.label} stat={stat} />
      ))}
    </Grid>
  )
}
