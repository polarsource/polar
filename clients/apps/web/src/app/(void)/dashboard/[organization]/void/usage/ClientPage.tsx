'use client'

import { VoidSection } from '@/components/Void/VoidSection'
import { useEvents } from '@/hooks/queries/events'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useContext } from 'react'

const formatTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)
  const { data } = useEvents(organization.id, {
    limit: 25,
    sorting: ['-timestamp'],
  })

  const events = data?.items ?? []
  const totalCount =
    data && 'total_count' in data.pagination
      ? data.pagination.total_count
      : undefined

  return (
    <Box as="main" flexDirection="column" paddingTop="5xl" flexGrow={1}>
      <VoidSection
        label="Usage"
        meta={
          totalCount !== undefined
            ? `${totalCount.toLocaleString('en-US')} events ingested`
            : undefined
        }
      >
        {events.length > 0 ? (
          <Box flexDirection="column" rowGap="xs">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/dashboard/${organization.slug}/void/usage/events/${event.id}`}
              >
                <Grid
                  templateColumns={{ base: '1fr auto', md: '1fr 2fr 1fr' }}
                  gap="l"
                  alignItems="baseline"
                  color={{ base: 'text-primary', hover: 'text-tertiary' }}
                  transitionProperty="colors"
                  transitionDuration="fast"
                  ease="decelerate"
                >
                  <Text variant="heading-xxs" monospace color="muted">
                    {formatTimestamp(event.timestamp)}
                  </Text>
                  <Text variant="heading-xxs" color="inherit">
                    {event.name}
                  </Text>
                  <Text variant="heading-xxs" color="muted" align="right">
                    {event.source}
                  </Text>
                </Grid>
              </Link>
            ))}
          </Box>
        ) : (
          <Box flexDirection="column" rowGap="s" paddingVertical="2xl">
            <Text variant="heading-m" color="muted">
              No events ingested
            </Text>
            <Text variant="heading-xxs" color="muted">
              POST /v1/events to start the stream
            </Text>
          </Box>
        )}
      </VoidSection>
    </Box>
  )
}
