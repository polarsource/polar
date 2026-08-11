'use client'

import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import { ToplistHeader } from '@/components/Shared/Toplist'
import { CHART_RANGES, ChartRange, getChartRangeParams } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { Grid, SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'
import { AtRiskList } from './AtRiskList'
import { CustomerGrowthChart } from './CustomerGrowthChart'
import { TopCostCustomersList } from './TopCostCustomersList'
import { TopCustomersList } from './TopCustomersList'

interface CustomersOverviewProps {
  organization: schemas['Organization']
}

export const CustomersOverview = ({ organization }: CustomersOverviewProps) => {
  const [range, setRange] = useState<ChartRange>('30d')
  const [startDate, endDate, interval] = useMemo(
    () => getChartRangeParams(range, organization.created_at),
    [range, organization.created_at],
  )

  return (
    <MasterDetailLayoutContent
      header={
        <>
          <Text variant="heading-xxs" as="h1">
            Customers
          </Text>
          <SegmentedControl
            options={(
              Object.entries(CHART_RANGES) as [ChartRange, string][]
            ).map(([value, label]) => ({ value, label }))}
            value={range}
            onChange={setRange}
          />
        </>
      }
    >
      <Box flexDirection="column" rowGap="4xl">
        <CustomerGrowthChart
          organization={organization}
          start={startDate}
          end={endDate}
          interval={interval}
        />
        <Grid
          templateColumns={{ base: '1fr', md: '1fr', xl: '1fr 1fr 1fr' }}
          gap="3xl"
        >
          <Box flexDirection="column" rowGap="l">
            <ToplistHeader title="Top Customers" caption="By net revenue" />
            <TopCustomersList
              organization={organization}
              start={startDate}
              end={endDate}
            />
          </Box>
          <Box flexDirection="column" rowGap="l">
            <ToplistHeader title="At Risk" caption="Past due & canceling" />
            <AtRiskList organization={organization} />
          </Box>
          <Box flexDirection="column" rowGap="l">
            <ToplistHeader
              title="Cost Drivers"
              caption="Ingested cost events"
            />
            <TopCostCustomersList
              organization={organization}
              start={startDate}
              end={endDate}
            />
          </Box>
        </Grid>
      </Box>
    </MasterDetailLayoutContent>
  )
}
