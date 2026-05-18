import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AppShell } from './_components/AppShell'
import { DateRangeSelector } from './_components/DateRangeSelector'
import { MetricsGrid } from './_components/MetricsGrid'

export default function OverviewPage() {
  return (
    <AppShell>
      <Box display="flex" flexDirection="column" rowGap="3xl">
        <Box
          display="flex"
          alignItems="baseline"
          justifyContent="between"
          paddingTop="m"
        >
          <Text variant="heading-s" as="h1">
            Overview
          </Text>
          <DateRangeSelector />
        </Box>

        <MetricsGrid />
      </Box>
    </AppShell>
  )
}
