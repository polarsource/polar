'use client'

import { dateRangeToMatchingInterval } from '@/components/Metrics/DateRangePicker'
import MetricChart from '@/components/Metrics/MetricChart'
import { estimateMeteredCost } from '@/components/Products/ProductForm/Pricing/utils'
import { ParsedMeterQuantities } from '@/hooks/queries/meters'
import { ParsedMetricPeriod } from '@/hooks/queries/metrics'
import { formatScalar } from '@/utils/formatters'
import { getTimestampFormatter } from '@/utils/metrics'
import { MeteredPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const formatDay = (value: Date | string) => {
  const date = new Date(value)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date().getFullYear() && {
      year: 'numeric',
    }),
  })
}

interface Figure {
  label: string
  value: string
  note?: string
  danger?: boolean
}

export interface CurrentPeriod {
  subscription: schemas['Subscription']
  customerMeter: schemas['CustomerMeter'] | null
  unitPrice: MeteredPrice | null
}

const sumUnits = (credits: schemas['MeterCreditEvent'][]) =>
  credits.reduce((sum, credit) => sum + credit.metadata.units, 0)

const getCreditedNote = (credits: schemas['MeterCreditEvent'][]) => {
  const credited = sumUnits(credits)
  const manualCredited = sumUnits(
    credits.filter((credit) => credit.metadata.reason === 'manual'),
  )
  if (manualCredited && manualCredited !== credited) {
    return `Incl. ${formatScalar(manualCredited)} manual`
  }
  if (manualCredited) return 'Added manually'
  return credited ? 'From benefits' : undefined
}

const getCurrentPeriodFigures = (
  { subscription, customerMeter, unitPrice }: CurrentPeriod,
  credits: schemas['MeterCreditEvent'][],
): Figure[] => {
  const credited = customerMeter?.credited_units ?? 0
  const used = customerMeter?.consumed_units ?? 0
  const balance = customerMeter?.balance ?? 0
  const overage = Math.max(0, -balance)
  const periodEnd = subscription.current_period_end

  return [
    {
      label: 'Credited',
      value: formatScalar(credited),
      note: getCreditedNote(credits),
    },
    {
      label: 'Used',
      value: formatScalar(used),
      note:
        overage > 0
          ? `${formatScalar(overage)} over credits`
          : credited > 0
            ? `${Math.round((used / credited) * 100)}% of credits`
            : undefined,
      danger: overage > 0,
    },
    {
      label: 'Remaining',
      value: formatScalar(Math.max(0, balance)),
      note: periodEnd ? `Renews ${formatDay(periodEnd)}` : undefined,
    },
    {
      label: 'Overage',
      value: unitPrice
        ? formatCurrency('compact')(
            estimateMeteredCost(unitPrice, overage),
            unitPrice.price_currency,
          )
        : '—',
      note:
        unitPrice && periodEnd ? `Billed ${formatDay(periodEnd)}` : undefined,
    },
  ]
}

const getRangeLabel = (
  organization: schemas['Organization'],
  from: Date,
  to: Date,
) => {
  const label = dateRangeToMatchingInterval({ from, to }, organization)?.label
  return label
    ? label[0] + label.slice(1).toLowerCase()
    : `${formatDay(from)} – ${formatDay(to)}`
}

const getRangeFigures = (
  rangeLabel: string,
  quantities: ParsedMeterQuantities | undefined,
  credits: schemas['MeterCreditEvent'][],
  interval: schemas['TimeInterval'],
): Figure[] => {
  const buckets = quantities?.quantities ?? []
  const peak = buckets.length
    ? buckets.reduce((max, bucket) =>
        bucket.quantity > max.quantity ? bucket : max,
      )
    : undefined

  return [
    {
      label: 'Used',
      value: formatScalar(quantities?.total ?? 0),
      note: rangeLabel,
    },
    {
      label: 'Credited',
      value: formatScalar(sumUnits(credits)),
      note: getCreditedNote(credits),
    },
    {
      label: `Peak ${interval}`,
      value: peak?.quantity ? formatScalar(peak.quantity) : '—',
      note: peak?.quantity
        ? getTimestampFormatter(interval)(new Date(peak.timestamp))
        : undefined,
    },
  ]
}

export const MeterPeriodSummary = ({
  organization,
  meter,
  currentPeriod,
  quantities,
  credits,
  startDate,
  endDate,
  interval,
}: {
  organization: schemas['Organization']
  meter: schemas['Meter']
  currentPeriod: CurrentPeriod | null
  quantities: ParsedMeterQuantities | undefined
  credits: schemas['MeterCreditEvent'][]
  startDate: Date
  endDate: Date
  interval: schemas['TimeInterval']
}) => {
  const figures = currentPeriod
    ? getCurrentPeriodFigures(currentPeriod, credits)
    : getRangeFigures(
        getRangeLabel(organization, startDate, endDate),
        quantities,
        credits,
        interval,
      )

  return (
    <Box
      flexDirection="column"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      borderRadius="l"
      overflow="hidden"
    >
      <Grid
        templateColumns={
          figures.length === 4
            ? { base: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }
            : { base: '1fr', md: 'repeat(3, 1fr)' }
        }
        style={{ clipPath: 'inset(0 1px 0 0)' }}
      >
        {figures.map((figure) => (
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
              <Text
                variant="caption"
                color={figure.danger ? 'danger' : 'muted'}
              >
                {figure.note}
              </Text>
            )}
          </Box>
        ))}
      </Grid>
      <Box display="block" padding="l">
        <MetricChart
          data={
            (quantities?.quantities ?? []) as unknown as ParsedMetricPeriod[]
          }
          interval={interval}
          height={240}
          metric={{
            slug: 'quantity',
            display_name: meter.name,
            type: 'scalar',
          }}
          showYAxis
          chartType={meter.aggregation.func === 'count' ? 'bar' : 'line'}
        />
      </Box>
    </Box>
  )
}
