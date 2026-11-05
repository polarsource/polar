import { useOrganizationAccount, useTransactionsSummary } from '@/hooks/queries'
import { usePayouts } from '@/hooks/queries/payouts'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { PayoutStatusIcon } from '@/components/Payouts/PayoutStatus'
import { ClientResponseError } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext } from 'react'
import { WidgetContainer } from './WidgetContainer'
import { WidgetLink } from './WidgetLink'
import { WidgetGuard, WidgetRestricted } from './WidgetGuard'

export interface AccountWidgetProps {
  className?: string
}

const WIDGET_TITLE = 'Available balance'

export const AccountWidget = ({ className }: AccountWidgetProps) => (
  <WidgetGuard
    permission="finance:read"
    title={WIDGET_TITLE}
    className={className}
  >
    <AccountWidgetContent className={className} />
  </WidgetGuard>
)

const AccountWidgetContent = ({ className }: AccountWidgetProps) => {
  const { organization: org } = useContext(OrganizationContext)

  const { data: account, error: accountError } = useOrganizationAccount(org.id)
  const { data: summary } = useTransactionsSummary(account?.id ?? '')
  const { data: payouts } = usePayouts(account?.id, {
    limit: 10,
    sorting: ['-created_at'],
  })

  // The permission is granted, but the account can still 403 for reasons
  // RBAC doesn't cover.
  if (
    accountError instanceof ClientResponseError &&
    accountError.response.status === 403
  ) {
    return (
      <WidgetRestricted
        permission="finance:read"
        title={WIDGET_TITLE}
        className={className}
      />
    )
  }

  const allPayouts = payouts?.items ?? []
  const availableBalance = formatCurrency('compact')(
    summary?.available_balance.amount ?? 0,
    summary?.available_balance.currency ?? 'usd',
  )

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Text variant="heading-m" weight="book">
          {availableBalance}
        </Text>
      }
      action={<WidgetLink href={`/dashboard/${org.slug}/finance`} />}
      className={className}
    >
      {allPayouts.length > 0 ? (
        <Box flexDirection="column" paddingBottom="m">
          {allPayouts.map((payout) => (
            <Box
              key={payout.id}
              alignItems="center"
              justifyContent="between"
              columnGap="m"
              paddingVertical="s"
              borderTopWidth={1}
              borderStyle="solid"
              borderColor="border-secondary"
            >
              <Text color="muted">
                {new Date(payout.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              <Box alignItems="center" columnGap="m" flexShrink={0}>
                <PayoutStatusIcon payout={payout} />
                <Text tabularNums>
                  {formatCurrency('compact')(payout.amount, payout.currency)}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <Box
          flex={1}
          flexDirection="column"
          justifyContent="end"
          rowGap="xs"
          paddingBottom="xl"
        >
          <Text>No payouts yet</Text>
          <Text color="muted">You may only withdraw funds above $10.</Text>
        </Box>
      )}
    </WidgetContainer>
  )
}
