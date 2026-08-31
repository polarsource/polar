'use client'

import { VoidSection } from '@/components/Void/VoidSection'
import { useCheckouts } from '@/hooks/queries/checkouts'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext } from 'react'

const shortDate = (timestamp: string) =>
  new Date(timestamp).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)
  const { data } = useCheckouts(organization.id, { limit: 25 })

  const checkouts = data?.items ?? []

  return (
    <Box as="main" flexDirection="column" paddingTop="xl" flexGrow={1}>
      <VoidSection flush label="Billing" meta={`${checkouts.length} checkouts`}>
        {checkouts.length > 0 ? (
          <Box flexDirection="column" rowGap="xl">
            {checkouts.map((checkout) => (
              <Grid
                key={checkout.id}
                templateColumns={{ base: '1fr auto', md: '1fr 2fr 1fr' }}
                gap="l"
                alignItems="baseline"
              >
                <Text variant="heading-xxs" monospace color="muted">
                  {shortDate(checkout.created_at)}
                </Text>
                <Text variant="heading-xs" truncate>
                  {checkout.customer_email ?? checkout.id.slice(0, 8)}
                </Text>
                <Text variant="heading-xxs" color="muted" align="right">
                  {checkout.status}
                </Text>
              </Grid>
            ))}
          </Box>
        ) : (
          <Text variant="heading-m" color="muted">
            No checkouts yet
          </Text>
        )}
      </VoidSection>
    </Box>
  )
}
