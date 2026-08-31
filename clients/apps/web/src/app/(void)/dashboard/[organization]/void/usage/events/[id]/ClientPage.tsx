'use client'

import { VoidCell, VoidGrid } from '@/components/Void/VoidGrid'
import { useEvent } from '@/hooks/queries/events'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useContext } from 'react'

const fullTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function ClientPage({ eventId }: { eventId: string }) {
  const { organization } = useContext(OrganizationContext)
  const { data: event } = useEvent(organization.id, eventId)

  const base = `/dashboard/${organization.slug}/void`

  if (!event) {
    return (
      <Box as="main" flexDirection="column" paddingTop="xl" flexGrow={1}>
        <Text variant="heading-m" color="muted">
          Loading event
        </Text>
      </Box>
    )
  }

  const metadata = Object.entries(event.metadata ?? {})
  const identityLabel =
    event.customer?.name ??
    event.customer?.email ??
    event.external_customer_id ??
    'none'

  const stats = [
    { label: 'Timestamp', value: fullTimestamp(event.timestamp) },
    { label: 'Identity', value: identityLabel, customerId: event.customer_id },
    { label: 'Source', value: event.source },
    { label: 'Child events', value: `${event.child_count ?? 0}` },
  ]

  return (
    <Box
      as="main"
      flexDirection="column"
      paddingTop="xl"
      paddingBottom="5xl"
      flexGrow={1}
      rowGap="4xl"
    >
      <Box flexDirection="column" rowGap="l">
        <Link href={`${base}/usage`}>
          <Text variant="heading-xxs" color="muted">
            Events
          </Text>
        </Link>
        <Box flexDirection="column" rowGap="m">
          <Text variant="heading-xxs" color="muted">
            {`${event.source} / ${event.id.slice(0, 8)}`}
          </Text>
          <Text variant="heading-2xl" as="h2">
            {event.name}
          </Text>
        </Box>
      </Box>
      <VoidGrid>
        {stats.map((stat) => (
          <VoidCell key={stat.label} minHeight={140}>
            <Box
              flexDirection="column"
              justifyContent="between"
              flexGrow={1}
              rowGap="l"
            >
              <Text variant="heading-xxs">{stat.label}</Text>
              {stat.customerId ? (
                <Link href={`${base}/usage/identities/${stat.customerId}`}>
                  <Text variant="heading-s" truncate>
                    {stat.value}
                  </Text>
                </Link>
              ) : (
                <Text variant="heading-s" truncate>
                  {stat.value}
                </Text>
              )}
            </Box>
          </VoidCell>
        ))}
      </VoidGrid>
      <Box flexDirection="column" rowGap="2xl">
        <Text variant="heading-xxs">Payload</Text>
        {metadata.length > 0 ? (
          <Box flexDirection="column" rowGap="s">
            {metadata.map(([key, value]) => (
              <Grid
                key={key}
                templateColumns={{ base: '1fr', md: '1fr 3fr' }}
                gap="l"
                alignItems="baseline"
              >
                <Text variant="heading-xxs" monospace color="muted">
                  {key}
                </Text>
                <Text variant="heading-xxs" monospace>
                  {formatValue(value)}
                </Text>
              </Grid>
            ))}
          </Box>
        ) : (
          <Text variant="heading-xxs" color="muted">
            No metadata on this event
          </Text>
        )}
      </Box>
    </Box>
  )
}
