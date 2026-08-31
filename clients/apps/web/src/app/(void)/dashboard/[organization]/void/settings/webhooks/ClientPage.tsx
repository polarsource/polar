'use client'

import { VoidSection } from '@/components/Void/VoidSection'
import { useListWebhooksEndpoints } from '@/hooks/queries/webhooks'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext } from 'react'

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)
  const { data } = useListWebhooksEndpoints({
    organizationId: organization.id,
    limit: 25,
    page: 1,
  })

  const endpoints = data?.items ?? []

  return (
    <Box as="main" flexDirection="column" paddingTop="5xl" flexGrow={1}>
      <VoidSection label="Settings" meta={`${endpoints.length} endpoints`}>
        {endpoints.length > 0 ? (
          <Box flexDirection="column" rowGap="xl">
            {endpoints.map((endpoint) => (
              <Grid
                key={endpoint.id}
                templateColumns={{ base: '1fr auto', md: '2fr 1fr 1fr' }}
                gap="l"
                alignItems="baseline"
              >
                <Text variant="heading-xxs" monospace truncate>
                  {endpoint.url}
                </Text>
                <Text variant="heading-xxs" color="muted">
                  {`${endpoint.format} / ${endpoint.events.length} events`}
                </Text>
                <Text
                  variant="heading-xxs"
                  color={endpoint.enabled ? 'default' : 'muted'}
                  align="right"
                >
                  {endpoint.enabled ? 'enabled' : 'disabled'}
                </Text>
              </Grid>
            ))}
          </Box>
        ) : (
          <Box flexDirection="column" rowGap="s" paddingVertical="2xl">
            <Text variant="heading-m" color="muted">
              No webhook endpoints
            </Text>
            <Text variant="heading-xxs" color="muted">
              Deliver billing events to your own infrastructure
            </Text>
          </Box>
        )}
      </VoidSection>
    </Box>
  )
}
