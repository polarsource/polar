'use client'

import { dateRangeToMatchingInterval } from '@/components/Metrics/DateRangePicker'
import MetricChart from '@/components/Metrics/MetricChart'
import { estimateMeteredCost } from '@/components/Products/ProductForm/Pricing/utils'
import { ParsedMeterQuantities } from '@/hooks/queries/meters'
import { ParsedMetricPeriod } from '@/hooks/queries/metrics'
import { formatScalar } from '@/utils/formatters'
import { MeteredPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'

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

const CARD_HEIGHT = 400

export interface CurrentPeriod {
  subscription: schemas['Subscription']
  customerMeter: schemas['CustomerMeter'] | null
  unitPrice: MeteredPrice | null
}

interface Usage {
  headline: string
  note: string
  danger?: boolean
  progress?: number
}

const getCurrentPeriodUsage = ({
  subscription,
  customerMeter,
  unitPrice,
}: CurrentPeriod): Usage => {
  const credited = customerMeter?.credited_units ?? 0
  const used = customerMeter?.consumed_units ?? 0
  const overage = Math.max(0, -(customerMeter?.balance ?? 0))
  const periodEnd = subscription.current_period_end
  const nextCycle = periodEnd && `Next cycle ${formatDay(periodEnd)}`

  if (credited === 0) {
    const cost =
      unitPrice &&
      formatCurrency('compact')(
        estimateMeteredCost(unitPrice, used),
        unitPrice.price_currency,
      )
    return {
      headline: `${formatScalar(used)} used`,
      note: [cost && `${cost} so far`, nextCycle].filter(Boolean).join(' · '),
    }
  }

  return {
    headline: `${formatScalar(used)} / ${formatScalar(credited)}`,
    note: [
      unitPrice
        ? `${formatCurrency('compact')(
            estimateMeteredCost(unitPrice, overage),
            unitPrice.price_currency,
          )} overages`
        : overage > 0 && `${formatScalar(overage)} over credits`,
      nextCycle,
    ]
      .filter(Boolean)
      .join(' · '),
    danger: overage > 0,
    progress: Math.min(1, used / credited),
  }
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

const getRangeUsage = (
  rangeLabel: string,
  quantities: ParsedMeterQuantities | undefined,
  credits: schemas['MeterCreditEvent'][],
): Usage => {
  const credited = credits.reduce(
    (sum, credit) => sum + credit.metadata.units,
    0,
  )
  return {
    headline: `${formatScalar(quantities?.total ?? 0)} used`,
    note: [credited && `${formatScalar(credited)} credited`, rangeLabel]
      .filter(Boolean)
      .join(' · '),
  }
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
  children,
}: {
  organization: schemas['Organization']
  meter: schemas['Meter']
  currentPeriod: CurrentPeriod | null
  quantities: ParsedMeterQuantities | undefined
  credits: schemas['MeterCreditEvent'][]
  startDate: Date
  endDate: Date
  interval: schemas['TimeInterval']
  children: ReactNode
}) => {
  const usage = currentPeriod
    ? getCurrentPeriodUsage(currentPeriod)
    : getRangeUsage(
        getRangeLabel(organization, startDate, endDate),
        quantities,
        credits,
      )

  const chart = (height: number) => (
    <MetricChart
      data={(quantities?.quantities ?? []) as unknown as ParsedMetricPeriod[]}
      interval={interval}
      height={height}
      metric={{ slug: 'quantity', display_name: meter.name, type: 'scalar' }}
      chartType="bar"
    />
  )
  return (
    <Grid
      templateColumns={{ base: '1fr', lg: 'minmax(0, 3fr) minmax(0, 2fr)' }}
      templateRows={{ lg: 'minmax(0, 1fr)' }}
      height={{ lg: CARD_HEIGHT }}
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      borderRadius="l"
      overflow="hidden"
    >
      <Box display="block" padding="l" alignSelf="center">
        {chart(CARD_HEIGHT - 48)}
      </Box>
      <Box
        flexDirection="column"
        minHeight={0}
        borderLeftWidth={{ base: 0, lg: 1 }}
        borderTopWidth={{ base: 1, lg: 0 }}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box flexDirection="column" rowGap="l" padding="xl">
          {usage.progress !== undefined && (
            <Box
              display="block"
              height={6}
              borderRadius="full"
              backgroundColor="background-card"
              overflow="hidden"
            >
              <Box
                display="block"
                height={6}
                borderRadius="full"
                backgroundColor="background-inverse"
                width={`${usage.progress * 100}%`}
              />
            </Box>
          )}
          <Box flexDirection="column" rowGap="xs">
            <Text variant="heading-xs" tabularNums>
              {usage.headline}
            </Text>
            <Text color={usage.danger ? 'danger' : 'muted'}>{usage.note}</Text>
          </Box>
        </Box>
        {children}
      </Box>
    </Grid>
  )
}
