import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AppShell } from '@/components/AppShell'
import { FinanceOverview } from '@/components/FinanceOverview'

export default function FinancePage() {
  return (
    <AppShell>
      <Box display="flex" flexDirection="column" rowGap="3xl" paddingTop="m">
        <Text variant="heading-s" as="h1">
          Finance
        </Text>
        <FinanceOverview />
      </Box>
    </AppShell>
  )
}
