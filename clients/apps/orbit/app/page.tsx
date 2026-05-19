import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AppShell } from '@/components/AppShell'
import { DateRangeSelector } from '@/components/DateRangeSelector'
import { MetricsGrid } from '@/components/MetricsGrid'

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
