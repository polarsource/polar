import { useHasPermission } from '@/hooks/permissions'
import { useMetrics } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { endOfMonth, startOfMonth } from 'date-fns'
import { useContext } from 'react'
import { WidgetContainer } from './WidgetContainer'
import { WidgetGuard } from './WidgetGuard'
import { WidgetLink } from './WidgetLink'

const WIDGET_TITLE = 'Subscriptions'

interface SubscriptionsWidgetProps {
  className?: string
}

export const SubscriptionsWidget = ({
  className,
}: SubscriptionsWidgetProps) => (
  <WidgetGuard
    permission="analytics:read"
    title={WIDGET_TITLE}
    className={className}
  >
    <SubscriptionsWidgetContent className={className} />
  </WidgetGuard>
)

const SubscriptionsWidgetContent = ({
  className,
}: SubscriptionsWidgetProps) => {
  const { organization } = useContext(OrganizationContext)
  const canReadSales = useHasPermission(organization.id, 'sales:read')

  const { data } = useMetrics({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    organization_id: organization.id,
    interval: 'month',
    metrics: [
      'active_subscriptions',
      'new_subscriptions',
      'canceled_subscriptions',
      'churned_subscriptions',
    ],
  })

  const period = data?.periods.at(-1)
  const rows = [
    { label: 'New', value: period?.new_subscriptions },
    { label: 'Canceled', value: period?.canceled_subscriptions },
    { label: 'Churned', value: period?.churned_subscriptions },
  ]

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-m" weight="book">
            {period ? (period.active_subscriptions ?? 0) : '–'}
          </Text>
          <Text color="muted">active</Text>
        </Box>
      }
      action={
        canReadSales ? (
          <WidgetLink
            href={`/dashboard/${organization.slug}/sales/subscriptions`}
          />
        ) : undefined
      }
      className={className}
    >
      <Box
        flex={1}
        flexDirection="column"
        justifyContent="end"
        paddingBottom="xl"
      >
        {rows.map((row) => (
          <Box
            key={row.label}
            alignItems="baseline"
            justifyContent="between"
            columnGap="m"
            paddingVertical="s"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-secondary"
          >
            <Text>{row.label}</Text>
            <Text tabularNums>{period ? (row.value ?? 0) : '–'}</Text>
          </Box>
        ))}
      </Box>
    </WidgetContainer>
  )
}
