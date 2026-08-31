'use client'

import { VoidSection } from '@/components/Void/VoidSection'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext } from 'react'

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)
  const { data } = useSubscriptions(organization.id, { limit: 25 })

  const subscriptions = data?.items ?? []

  return (
    <Box as="main" flexDirection="column" paddingTop="xl" flexGrow={1}>
      <VoidSection
        flush
        label="Billing"
        meta={`${subscriptions.length} subscriptions`}
      >
        {subscriptions.length > 0 ? (
          <Box flexDirection="column" rowGap="xl">
            {subscriptions.map((subscription) => (
              <Grid
                key={subscription.id}
                templateColumns={{ base: '1fr auto', md: '2fr 1fr 1fr' }}
                gap="l"
                alignItems="baseline"
              >
                <Text variant="heading-xs" truncate>
                  {subscription.customer.name ?? subscription.customer.email}
                </Text>
                <Text variant="heading-xxs" color="muted" truncate>
                  {`${subscription.product.name} / ${subscription.status}`}
                </Text>
                <Text variant="heading-xxs" color="muted" align="right">
                  {subscription.current_period_end
                    ? `renews ${new Date(
                        subscription.current_period_end,
                      ).toLocaleDateString('en-US', {
                        day: '2-digit',
                        month: 'short',
                      })}`
                    : 'no renewal'}
                </Text>
              </Grid>
            ))}
          </Box>
        ) : (
          <Text variant="heading-m" color="muted">
            No subscriptions yet
          </Text>
        )}
      </VoidSection>
    </Box>
  )
}
