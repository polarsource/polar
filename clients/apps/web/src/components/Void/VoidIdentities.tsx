'use client'

import { useCustomers } from '@/hooks/queries/customers'
import { useOrders } from '@/hooks/queries/orders'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { subDays } from 'date-fns'
import Link from 'next/link'
import { useContext, useMemo } from 'react'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import {
  aggregateSpend,
  buildSegments,
  buildSignals,
  identityKind,
} from './identityInsights'
import { VoidCell, VoidGrid } from './VoidGrid'
import { VoidSection } from './VoidSection'
import { VoidSegmentBar } from './VoidSegmentBar'

export const VoidIdentities = ({
  organizationId,
}: {
  organizationId: string
}) => {
  const { organization } = useContext(OrganizationContext)
  const identitiesPath = `/dashboard/${organization.slug}/void/usage/identities`
  const { data: customersData } = useCustomers(organizationId, { limit: 20 })
  const { data: ordersData } = useOrders(organizationId, {
    limit: 100,
    sorting: ['-created_at'],
  })

  const since = useMemo(() => subDays(new Date(), 30), [])

  const customers = useMemo(
    () => customersData?.pages.flatMap((page) => page.items) ?? [],
    [customersData],
  )
  const spenders = useMemo(
    () => aggregateSpend(ordersData?.items ?? [], since),
    [ordersData, since],
  )
  const totalSpend = useMemo(
    () => spenders.reduce((sum, spender) => sum + spender.spend, 0),
    [spenders],
  )
  const segments = useMemo(
    () => buildSegments(customers, spenders),
    [customers, spenders],
  )
  const dormant = segments.find((segment) => segment.label === 'Dormant')
  const signals = useMemo(
    () => buildSignals(spenders, totalSpend, dormant?.count ?? 0),
    [spenders, totalSpend, dormant],
  )

  const agents = customers.filter(
    (customer) => identityKind(customer) === 'agent',
  ).length
  const humans = customers.length - agents
  const top = spenders.slice(0, 4)
  const maxSpend = top[0]?.spend ?? 0

  return (
    <VoidSection
      label="Identities"
      anchor="identities"
      meta={
        customers.length > 0 ? `${humans} human / ${agents} agent` : undefined
      }
    >
      {customers.length > 0 ? (
        <VoidGrid>
          <VoidCell colSpan={{ base: 1, md: 2, lg: 4 }}>
            <Box flexDirection="column" rowGap="2xl">
              <Text variant="heading-xxs">Cohort health</Text>
              <VoidSegmentBar
                segments={segments.map(({ label, share, tone, count }) => ({
                  label,
                  share,
                  tone,
                  detail: `${count}`,
                }))}
              />
            </Box>
          </VoidCell>
          <VoidCell colSpan={{ base: 1, md: 2, lg: 2 }}>
            <Box flexDirection="column" rowGap="2xl" flexGrow={1}>
              <Text variant="heading-xxs">Top identities / 30 days</Text>
              <Box flexDirection="column" rowGap="xl">
                {top.map((spender, position) => (
                  <Link
                    key={spender.id}
                    href={`${identitiesPath}/${spender.id}`}
                  >
                    <Box
                      flexDirection="column"
                      rowGap="s"
                      color={{ base: 'text-primary', hover: 'text-tertiary' }}
                      transitionProperty="colors"
                      transitionDuration="fast"
                      ease="decelerate"
                    >
                      <Box
                        justifyContent="between"
                        columnGap="l"
                        alignItems="baseline"
                      >
                        <Box columnGap="l" alignItems="baseline">
                          <Text variant="heading-xxs" color="muted" tabularNums>
                            {String(position + 1).padStart(2, '0')}
                          </Text>
                          <Text variant="heading-xs" color="inherit" truncate>
                            {spender.name}
                          </Text>
                        </Box>
                        <Text variant="heading-xs" color="inherit">
                          {formatCurrency('standard')(spender.spend, 'usd')}
                        </Text>
                      </Box>
                      <Box
                        height={2}
                        width={
                          maxSpend > 0
                            ? `${(spender.spend / maxSpend) * 100}%`
                            : '0%'
                        }
                        backgroundColor="background-inverse"
                      />
                    </Box>
                  </Link>
                ))}
              </Box>
              <Link href={identitiesPath}>
                <Text variant="heading-xxs" color="muted">
                  View all identities
                </Text>
              </Link>
            </Box>
          </VoidCell>
          <VoidCell colSpan={{ base: 1, md: 2, lg: 2 }}>
            <Box flexDirection="column" rowGap="2xl" flexGrow={1}>
              <Text variant="heading-xxs">Signals</Text>
              <Box flexDirection="column" rowGap="xl">
                {signals.map((signal) => (
                  <Box key={signal.title} flexDirection="column" rowGap="xs">
                    <Text variant="heading-xs">{signal.title}</Text>
                    <Text variant="heading-xxs" color="muted">
                      {signal.detail}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          </VoidCell>
        </VoidGrid>
      ) : (
        <VoidGrid>
          <VoidCell colSpan={{ base: 1, md: 2, lg: 4 }}>
            <Box flexDirection="column" rowGap="s" paddingVertical="2xl">
              <Text variant="heading-m" color="muted">
                No identities yet
              </Text>
              <Text variant="heading-xxs" color="muted">
                Humans and agents appear here once they start consuming usage
              </Text>
            </Box>
          </VoidCell>
        </VoidGrid>
      )}
    </VoidSection>
  )
}
