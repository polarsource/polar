import { cancelDate, useAtRisk } from '@/components/Customer/useAtRisk'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useContext } from 'react'
import { WidgetContainer } from './WidgetContainer'
import { WidgetError } from './WidgetError'
import { WidgetLink } from './WidgetLink'
import { WidgetGuard } from './WidgetGuard'

const WIDGET_TITLE = 'At risk'
// Matches the At risk page, so both share the same cached queries.
const LIMIT = 100
const VISIBLE_ROWS = 5

export interface CustomerRiskWidgetProps {
  className?: string
}

export const CustomerRiskWidget = ({ className }: CustomerRiskWidgetProps) => (
  <WidgetGuard
    permission="sales:read"
    title={WIDGET_TITLE}
    className={className}
  >
    <CustomerRiskWidgetContent className={className} />
  </WidgetGuard>
)

const CustomerRiskWidgetContent = ({ className }: CustomerRiskWidgetProps) => {
  const { organization } = useContext(OrganizationContext)
  const { items, isLoading, isError, refetch } = useAtRisk(organization, LIMIT)
  const failed = isError && items.length === 0
  const basePath = `/dashboard/${organization.slug}/customers`
  const count = items.length >= LIMIT ? `${LIMIT}+` : `${items.length}`

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Text variant="heading-m" weight="book">
          {isLoading || failed ? '–' : count}
        </Text>
      }
      action={<WidgetLink href={`${basePath}/at-risk`} />}
      className={className}
    >
      {failed ? (
        <WidgetError
          title="Couldn't load at-risk subscriptions"
          onRetry={() => refetch()}
        />
      ) : !isLoading && items.length === 0 ? (
        <Box
          flex={1}
          flexDirection="column"
          justifyContent="end"
          rowGap="xs"
          paddingBottom="xl"
        >
          <Text>Nothing at risk</Text>
          <Text color="muted">
            No payment issues or scheduled cancellations.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingBottom="m">
          {items.slice(0, VISIBLE_ROWS).map(({ subscription, reason }) => (
            <Link
              key={subscription.id}
              href={`${basePath}/${subscription.customer_id}`}
              className="hover:opacity-60"
            >
              <Box
                alignItems="center"
                justifyContent="between"
                columnGap="m"
                paddingVertical="s"
                borderTopWidth={1}
                borderStyle="solid"
                borderColor="border-secondary"
              >
                <Box alignItems="baseline" columnGap="s" minWidth={0}>
                  <Text truncate>
                    {subscription.customer.name ??
                      subscription.customer.email ??
                      '-'}
                  </Text>
                  <Text color="muted" truncate>
                    {subscription.product.name}
                  </Text>
                </Box>
                <Box alignItems="baseline" columnGap="m" flexShrink={0}>
                  <Text color="muted">
                    {reason === 'past_due'
                      ? 'Past due'
                      : `Cancels ${cancelDate(subscription)}`}
                  </Text>
                  <Text tabularNums>
                    {formatCurrency('statistics')(
                      subscription.amount,
                      subscription.currency,
                    )}
                  </Text>
                </Box>
              </Box>
            </Link>
          ))}
        </Box>
      )}
    </WidgetContainer>
  )
}
