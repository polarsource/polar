import { useMetrics, useTopCustomers } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { startOfMonth, subMonths } from 'date-fns'
import Link from 'next/link'
import { useContext, useState } from 'react'
import { WidgetContainer } from './WidgetContainer'
import { WidgetError } from './WidgetError'
import { WidgetGuard } from './WidgetGuard'
import { WidgetLink } from './WidgetLink'

const WIDGET_TITLE = 'Top customers'
const LIMIT = 5

interface TopCustomersWidgetProps {
  className?: string
}

export const TopCustomersWidget = ({ className }: TopCustomersWidgetProps) => (
  <WidgetGuard
    permission="customers:read"
    title={WIDGET_TITLE}
    className={className}
  >
    <TopCustomersWidgetContent className={className} />
  </WidgetGuard>
)

const TopCustomersWidgetContent = ({ className }: TopCustomersWidgetProps) => {
  const { organization } = useContext(OrganizationContext)
  const [[start, end]] = useState(() => {
    const now = new Date()
    return [startOfMonth(subMonths(now, 11)), now] as const
  })
  const basePath = `/dashboard/${organization.slug}/customers`

  const {
    data: customers,
    isLoading,
    isError,
    refetch,
  } = useTopCustomers(organization.id, {
    start,
    end,
    limit: LIMIT,
  })
  const { data: metrics } = useMetrics({
    startDate: start,
    endDate: end,
    organization_id: organization.id,
    interval: 'month',
    metrics: ['revenue'],
  })

  const topRevenue = (customers ?? []).reduce(
    (sum, customer) => sum + customer.net_revenue,
    0,
  )
  // Both sides are pre-fee and pre-tax; the customer totals also subtract
  // refunds, which the revenue metric doesn't.
  const totalRevenue = metrics?.totals.revenue ?? 0
  const share =
    totalRevenue > 0 ? Math.round((topRevenue / totalRevenue) * 100) : null

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-m" weight="book">
            {share != null && !isError ? `${share}%` : '–'}
          </Text>
          <Text color="muted">of revenue</Text>
        </Box>
      }
      action={<WidgetLink href={basePath} />}
      className={className}
    >
      {isError ? (
        <WidgetError
          title="Couldn't load top customers"
          onRetry={() => refetch()}
        />
      ) : !isLoading && (customers ?? []).length === 0 ? (
        <Box
          flex={1}
          flexDirection="column"
          justifyContent="end"
          rowGap="xs"
          paddingBottom="xl"
        >
          <Text>No revenue yet</Text>
          <Text color="muted">No paid orders in the last 12 months.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingBottom="m">
          {(customers ?? []).map((customer) => (
            <Link
              key={customer.id}
              href={`${basePath}/${customer.id}`}
              className="hover:opacity-60"
            >
              <Box
                alignItems="baseline"
                justifyContent="between"
                columnGap="m"
                paddingVertical="s"
                borderTopWidth={1}
                borderStyle="solid"
                borderColor="border-secondary"
              >
                <Box alignItems="baseline" columnGap="s" minWidth={0}>
                  <Text truncate>{customer.name ?? customer.email ?? '-'}</Text>
                  <Text color="muted">
                    {customer.order_count}{' '}
                    {customer.order_count === 1 ? 'order' : 'orders'}
                  </Text>
                </Box>
                <Text tabularNums>
                  {formatCurrency('statistics')(customer.net_revenue, 'usd')}
                </Text>
              </Box>
            </Link>
          ))}
        </Box>
      )}
    </WidgetContainer>
  )
}
