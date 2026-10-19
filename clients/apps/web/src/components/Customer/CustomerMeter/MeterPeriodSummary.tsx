'use client'

import MetricChart from '@/components/Metrics/MetricChart'
import { estimateMeteredCost } from '@/components/Products/ProductForm/Pricing/utils'
import { ParsedMetricPeriod } from '@/hooks/queries/metrics'
import { MeteredPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { formatDay } from './MeterPeriodSelect'
import { MeterPeriod, useMeterPeriodUsage } from './useMeterPeriods'

const formatUnits = (units: number) => units.toLocaleString('en-US')

interface Figure {
  label: string
  value: string
  note?: string
  danger?: boolean
}

const getFigures = (
  period: MeterPeriod,
  usage: ReturnType<typeof useMeterPeriodUsage>,
  unitPrice: MeteredPrice | null,
): Figure[] => {
  const { credited, manualCredited, used, balance } = usage
  const planCredited = credited - manualCredited
  const overage = Math.max(0, -balance)

  return [
    {
      label: 'Credited',
      value: formatUnits(credited),
      note:
        planCredited && manualCredited
          ? `${formatUnits(planCredited)} plan · ${formatUnits(manualCredited)} manual`
          : manualCredited
            ? 'Added manually'
            : credited
              ? 'From plan'
              : undefined,
    },
    {
      label: 'Used',
      value: formatUnits(used),
      note:
        overage > 0
          ? `${formatUnits(overage)} over credits`
          : credited > 0
            ? `${Math.round((used / credited) * 100)}% of credits`
            : undefined,
      danger: overage > 0,
    },
    {
      label: 'Remaining',
      value: formatUnits(Math.max(0, balance)),
      note: period.end
        ? `${period.current ? 'Renews' : 'Ended'} ${formatDay(period.end)}`
        : undefined,
    },
    {
      label: 'Overage',
      // shortcut: past periods are priced at the current plan's rate, read the period's order to be exact
      value: unitPrice
        ? formatCurrency('compact')(
            estimateMeteredCost(unitPrice, overage),
            unitPrice.price_currency,
          )
        : '—',
      note:
        unitPrice && period.end ? `Billed ${formatDay(period.end)}` : undefined,
    },
  ]
}

export const MeterPeriodSummary = ({
  meter,
  period,
  usage,
  unitPrice,
}: {
  meter: schemas['Meter']
  period: MeterPeriod
  usage: ReturnType<typeof useMeterPeriodUsage>
  unitPrice: MeteredPrice | null
}) => (
  <Box
    flexDirection="column"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    borderRadius="l"
    overflow="hidden"
  >
    <Grid
      templateColumns={{ base: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }}
      // Hides the outer right border so only the dividers between cells show.
      style={{ clipPath: 'inset(0 1px 0 0)' }}
    >
      {getFigures(period, usage, unitPrice).map((figure) => (
        <Box
          key={figure.label}
          flexDirection="column"
          rowGap="xs"
          padding="xl"
          borderRightWidth={1}
          borderBottomWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <Text color="muted">{figure.label}</Text>
          <Text variant="heading-xs" tabularNums>
            {figure.value}
          </Text>
          {figure.note && (
            <Text variant="caption" color={figure.danger ? 'danger' : 'muted'}>
              {figure.note}
            </Text>
          )}
        </Box>
      ))}
    </Grid>
    <Box display="block" padding="l">
      <MetricChart
        data={
          (usage.quantities?.quantities ??
            []) as unknown as ParsedMetricPeriod[]
        }
        interval={usage.interval}
        height={240}
        metric={{ slug: 'quantity', display_name: meter.name, type: 'scalar' }}
        showYAxis
        chartType={meter.aggregation.func === 'count' ? 'bar' : 'line'}
      />
    </Box>
  </Box>
)
