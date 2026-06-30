import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AppShell } from '@/components/AppShell'
import { DateRangeSelector } from '@/components/DateRangeSelector'
import { MetricsView } from '@/components/MetricsView'

export default function MetricsPage() {
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
            Metrics
          </Text>
          <DateRangeSelector />
        </Box>
        <MetricsView />
      </Box>
    </AppShell>
  )
}
