'use client'

import { useEvents } from '@/hooks/queries/events'
import { useMeters } from '@/hooks/queries/meters'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useContext } from 'react'
import { VoidCell, VoidGrid } from './VoidGrid'
import { VoidSection } from './VoidSection'

const lastSeen = (timestamp: string) =>
  new Date(timestamp).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

export const VoidInfrastructure = () => {
  const { organization } = useContext(OrganizationContext)
  const base = `/dashboard/${organization.slug}/void`

  const { data: metersData } = useMeters(organization.id, {
    limit: 1,
    is_archived: false,
  })
  const { data: eventsData } = useEvents(organization.id, {
    limit: 1,
    sorting: ['-timestamp'],
  })

  const meterCount =
    metersData && 'total_count' in metersData.pagination
      ? metersData.pagination.total_count
      : (metersData?.items.length ?? 0)
  const eventCount =
    eventsData && 'total_count' in eventsData.pagination
      ? eventsData.pagination.total_count
      : (eventsData?.items.length ?? 0)
  const lastEvent = eventsData?.items[0]?.timestamp

  const cells = [
    {
      label: 'Meters',
      value: `${meterCount}`,
      meta: 'running',
      href: `${base}/usage/meters`,
      span: { base: 1, md: 2, lg: 1 },
    },
    {
      label: 'Definition',
      value: 'v14',
      meta: 'sha 8f2c41a / active',
      href: `${base}/billing`,
      span: { base: 1, md: 2, lg: 1 },
    },
    {
      label: 'Event stream',
      value: eventCount.toLocaleString('en-US'),
      meta: lastEvent ? `last ingested ${lastSeen(lastEvent)}` : 'no events',
      href: `${base}/usage`,
      span: { base: 1, md: 2, lg: 2 },
    },
  ]

  return (
    <VoidSection label="Infrastructure" meta="Billing as code">
      <VoidGrid>
        {cells.map((cell) => (
          <VoidCell key={cell.label} colSpan={cell.span} minHeight={200}>
            <Link href={cell.href} className="flex grow">
              <Box
                flexDirection="column"
                justifyContent="between"
                flexGrow={1}
                rowGap="2xl"
                color={{ base: 'text-primary', hover: 'text-tertiary' }}
                transitionProperty="colors"
                transitionDuration="fast"
                ease="decelerate"
              >
                <Text variant="heading-xxs">{cell.label}</Text>
                <Box flexDirection="column" rowGap="s">
                  <Text variant="heading-l" color="inherit">
                    {cell.value}
                  </Text>
                  <Text variant="heading-xxs" color="muted">
                    {cell.meta}
                  </Text>
                </Box>
              </Box>
            </Link>
          </VoidCell>
        ))}
      </VoidGrid>
    </VoidSection>
  )
}
