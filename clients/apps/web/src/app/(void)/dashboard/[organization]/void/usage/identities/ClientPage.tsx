'use client'

import {
  aggregateSpend,
  buildSegments,
  identityKind,
} from '@/components/Void/identityInsights'
import { VoidSection } from '@/components/Void/VoidSection'
import { VoidSegmentBar } from '@/components/Void/VoidSegmentBar'
import { useCustomers } from '@/hooks/queries/customers'
import { useOrders } from '@/hooks/queries/orders'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { subDays } from 'date-fns'
import Link from 'next/link'
import { useContext, useMemo } from 'react'

const firstSeen = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)

  const { data: customersData } = useCustomers(organization.id, { limit: 50 })
  const { data: ordersData } = useOrders(organization.id, {
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
  const segments = useMemo(
    () => buildSegments(customers, spenders),
    [customers, spenders],
  )

  const spendById = useMemo(
    () => new Map(spenders.map((spender) => [spender.id, spender.spend])),
    [spenders],
  )
  const ranked = useMemo(
    () =>
      [...customers].sort(
        (a, b) => (spendById.get(b.id) ?? 0) - (spendById.get(a.id) ?? 0),
      ),
    [customers, spendById],
  )
  const maxSpend = spendById.size > 0 ? Math.max(...spendById.values()) : 0

  const agents = customers.filter(
    (customer) => identityKind(customer) === 'agent',
  ).length
  const humans = customers.length - agents

  return (
    <Box as="main" flexDirection="column" paddingTop="xl" flexGrow={1}>
      <VoidSection
        flush
        label="Identities"
        meta={`${humans} human / ${agents} agent`}
      >
        <VoidSegmentBar
          segments={segments.map(({ label, share, tone, count }) => ({
            label,
            share,
            tone,
            detail: `${count}`,
          }))}
        />
        <Box flexDirection="column" rowGap="2xl" paddingTop="2xl">
          {ranked.map((customer, position) => {
            const spend = spendById.get(customer.id) ?? 0
            return (
              <Link
                key={customer.id}
                href={`/dashboard/${organization.slug}/void/identities/${customer.id}`}
              >
                <Box
                  flexDirection="column"
                  rowGap="s"
                  color={{ base: 'text-primary', hover: 'text-tertiary' }}
                  transitionProperty="colors"
                  transitionDuration="fast"
                  ease="decelerate"
                >
                  <Grid
                    templateColumns={{
                      base: '1fr auto',
                      md: '64px 2fr 1fr 1fr',
                    }}
                    gap="l"
                    alignItems="baseline"
                  >
                    <Text variant="heading-xxs" color="muted" tabularNums>
                      {String(position + 1).padStart(2, '0')}
                    </Text>
                    <Text variant="heading-m" color="inherit" truncate>
                      {customer.name ?? customer.email}
                    </Text>
                    <Text variant="heading-xxs" color="muted">
                      {`${identityKind(customer)} / first seen ${firstSeen(customer.created_at)}`}
                    </Text>
                    <Text variant="heading-xs" align="right">
                      {formatCurrency('standard')(spend, 'usd')}
                    </Text>
                  </Grid>
                  <Box
                    height={2}
                    width={maxSpend > 0 ? `${(spend / maxSpend) * 100}%` : '0%'}
                    backgroundColor="background-inverse"
                  />
                </Box>
              </Link>
            )
          })}
        </Box>
      </VoidSection>
    </Box>
  )
}
