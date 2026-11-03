import { useHasPermission } from '@/hooks/permissions'
import { useMetrics } from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import Link from 'next/link'
import { useContext } from 'react'
import { WidgetContainer } from './WidgetContainer'
import { WidgetGuard } from './WidgetGuard'
import { WidgetLink } from './WidgetLink'

const WIDGET_TITLE = 'Orders'
const VISIBLE_ROWS = 5

interface OrdersWidgetProps {
  className?: string
}

export const OrdersWidget = ({ className }: OrdersWidgetProps) => (
  <WidgetGuard
    permission="sales:read"
    title={WIDGET_TITLE}
    className={className}
  >
    <OrdersWidgetContent className={className} />
  </WidgetGuard>
)

const OrdersWidgetContent = ({ className }: OrdersWidgetProps) => {
  const { organization } = useContext(OrganizationContext)
  const canReadAnalytics = useHasPermission(organization.id, 'analytics:read')
  const basePath = `/dashboard/${organization.slug}/sales`

  const { data: orders, isLoading } = useOrders(organization.id, {
    limit: VISIBLE_ROWS,
    sorting: ['-created_at'],
  })
  const { data: metrics } = useMetrics(
    {
      startDate: startOfMonth(new Date()),
      endDate: endOfMonth(new Date()),
      organization_id: organization.id,
      interval: 'month',
      metrics: ['orders'],
    },
    canReadAnalytics,
  )
  const thisMonth = metrics?.periods.at(-1)
  const items = orders?.items ?? []

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-m" weight="book">
            {thisMonth ? (thisMonth.orders ?? 0) : '–'}
          </Text>
          {thisMonth && (
            <Text color="muted">{format(thisMonth.timestamp, 'MMMM')}</Text>
          )}
        </Box>
      }
      action={<WidgetLink href={basePath} />}
      className={className}
    >
      {!isLoading && items.length === 0 ? (
        <Box
          flex={1}
          flexDirection="column"
          justifyContent="end"
          rowGap="xs"
          paddingBottom="xl"
        >
          <Text>No orders yet</Text>
          <Text color="muted">
            Orders will show up here once customers buy.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingBottom="xl">
          {items.map((order) => (
            <Link
              key={order.id}
              href={`${basePath}/${order.id}`}
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
                  <Text truncate>{order.description}</Text>
                  <Text color="muted">
                    {format(new Date(order.created_at), 'MMM d')}
                  </Text>
                </Box>
                <Text tabularNums>
                  {formatCurrency('accounting')(
                    order.net_amount,
                    order.currency,
                  )}
                </Text>
              </Box>
            </Link>
          ))}
        </Box>
      )}
    </WidgetContainer>
  )
}
