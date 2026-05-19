import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AppShell } from '@/components/AppShell'
import { CustomersList } from '@/components/CustomersList'

export default function CustomersPage() {
  return (
    <AppShell>
      <Box display="flex" flexDirection="column" rowGap="3xl" paddingTop="m">
        <Text variant="heading-s" as="h1">
          Customers
        </Text>
        <CustomersList />
      </Box>
    </AppShell>
  )
}
