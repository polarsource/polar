'use client'

import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import { CHART_RANGES, ChartRange } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PropsWithChildren } from 'react'
import { CustomersSubnav } from './CustomersSubnav'

interface CustomersPageShellProps extends PropsWithChildren {
  organization: schemas['Organization']
  range?: ChartRange
  onRangeChange?: (range: ChartRange) => void
}

export const CustomersPageShell = ({
  organization,
  range,
  onRangeChange,
  children,
}: CustomersPageShellProps) => (
  <MasterDetailLayoutContent
    header={
      <Box
        height="2rem"
        display="flex"
        flexDirection="row"
        alignItems="center"
        justifyContent="between"
        rowGap="xl"
        width="100%"
      >
        <Text variant="heading-xs" as="h1">
          Customers
        </Text>
        {range && onRangeChange ? (
          <SegmentedControl
            options={(
              Object.entries(CHART_RANGES) as [ChartRange, string][]
            ).map(([value, label]) => ({ value, label }))}
            value={range}
            onChange={onRangeChange}
          />
        ) : null}
      </Box>
    }
  >
    <Box flexDirection="column" rowGap="2xl">
      <CustomersSubnav organization={organization} />
      {children}
    </Box>
  </MasterDetailLayoutContent>
)
