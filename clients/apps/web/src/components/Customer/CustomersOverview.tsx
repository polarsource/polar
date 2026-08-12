'use client'

import { ToplistHeader } from '@/components/Shared/Toplist'
import { useHasPermission } from '@/hooks/permissions'
import { ChartRange, getChartRangeParams } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { Grid } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'
import { AtRiskList } from './AtRiskList'
import { CustomerGrowthChart } from './CustomerGrowthChart'
import { CustomersPageShell } from './CustomersPageShell'
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
  const canReadAnalytics = useHasPermission(organization.id, 'analytics:read')

  return (
    <CustomersPageShell
      organization={organization}
      range={range}
      onRangeChange={setRange}
    >
      <Box flexDirection="column" rowGap="4xl">
        <CustomerGrowthChart
          organization={organization}
          start={startDate}
          end={endDate}
          interval={interval}
        />
        <Grid
          templateColumns={{
            base: '1fr',
            md: '1fr',
            xl: canReadAnalytics ? '1fr 1fr 1fr' : '1fr 1fr',
          }}
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
          {canReadAnalytics && (
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
          )}
        </Grid>
      </Box>
    </CustomersPageShell>
  )
}
