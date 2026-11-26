'use client'

import {
  AGGREGATION_DISPLAY_NAMES,
  formatProperty,
} from '@/components/Meter/MeterFilterReadOnlyConfiguration'
import {
  CondensedTable,
  CondensedTableHeader,
  useCondensedTable,
} from '@/components/Shared/CondensedTable'
import { useSubscriptionBillingIntervals } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { BillingIntervalGenerationLine } from './BillingIntervalGenerationLine'
import {
  getBillingIntervalColumns,
  getBillingIntervalRows,
  type BillingIntervalRow,
} from './billingIntervalColumns'

const getRowId = (row: BillingIntervalRow) => row.id

const MeterUsage = ({
  organization,
  usages,
}: {
  organization: schemas['Organization']
  usages: schemas['SubscriptionBillingIntervalUsage'][]
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const table = useCondensedTable({
    columns: getBillingIntervalColumns(organization),
    rows: getBillingIntervalRows(usages),
    getRowId,
  })
  const { meter } = usages[0].interval
  const aggregation = AGGREGATION_DISPLAY_NAMES[meter.aggregation.func]

  return (
    <Box flexDirection="column" rowGap="m">
      <Box alignItems="baseline" columnGap="m">
        <Text variant="heading-xxs" as="h4">
          {meter.name}
        </Text>
        <Text color="muted">
          {'property' in meter.aggregation
            ? `${aggregation} of ${formatProperty(meter.aggregation.property)}`
            : aggregation}
        </Text>
      </Box>
      <Box flexDirection="column" marginHorizontal="-m">
        <CondensedTableHeader table={table} expandable />
        <CondensedTable
          table={table}
          expansion={{
            canExpand: (row) => (row.group?.generations.length ?? 0) > 1,
            isExpanded: (row) => !collapsed[row.id],
            onToggle: (row) =>
              setCollapsed((current) => ({
                ...current,
                [row.id]: !current[row.id],
              })),
            render: (row) =>
              row.group?.generations.map((generation) => (
                <BillingIntervalGenerationLine
                  key={`${generation.generation}-${generation.order_id}`}
                  organization={organization}
                  generation={generation}
                  currency={row.interval.product_price.price_currency}
                />
              )),
          }}
        />
      </Box>
    </Box>
  )
}

export const SubscriptionBillingIntervals = ({
  organization,
  subscription,
}: {
  organization: schemas['Organization']
  subscription: schemas['Subscription']
}) => {
  const enabled = !!organization.feature_settings?.reducer_billing_enabled
  const { data } = useSubscriptionBillingIntervals(subscription.id, { enabled })
  if (!data?.length) {
    return null
  }
  const byMeter = new Map<string, typeof data>()
  for (const usage of data) {
    const meterId = usage.interval.meter.id
    byMeter.set(meterId, [...(byMeter.get(meterId) ?? []), usage])
  }

  return (
    <Box
      as="section"
      aria-label="Meter usage"
      flexDirection="column"
      rowGap="2xl"
    >
      <Text variant="heading-xs" as="h3">
        Meter Usage
      </Text>
      {[...byMeter.entries()].map(([meterId, usages]) => (
        <MeterUsage key={meterId} organization={organization} usages={usages} />
      ))}
    </Box>
  )
}
