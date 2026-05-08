'use client'

import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Pill from '@polar-sh/ui/components/atoms/Pill'

const formatPrice = formatCurrency('standard', 'en-US')

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  trialing: 'Trial',
  unpaid: 'Unpaid',
  incomplete: 'Incomplete',
  incomplete_expired: 'Expired',
}

const STATUS_COLOR: Record<string, 'green' | 'yellow' | 'red' | 'blue'> = {
  active: 'green',
  past_due: 'yellow',
  canceled: 'red',
  trialing: 'blue',
  unpaid: 'red',
  incomplete: 'yellow',
  incomplete_expired: 'red',
}

const Detail = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <Box display="flex" flexDirection="column" rowGap="xs">
    <Text color="muted">{label}</Text>
    <Text>{children}</Text>
  </Box>
)

const formatFee = (fee: schemas['OrganizationPlanFee']) => {
  const percent = (fee.percent / 100).toFixed(2)
  const fixed = (fee.fixed / 100).toFixed(2)
  return `${percent}% + $${fixed}`
}

export const BillingSubscriptionCard = ({
  subscription,
  plans,
  onChangePlan,
}: {
  subscription: schemas['OrganizationSubscription']
  plans: schemas['OrganizationPlan'][]
  onChangePlan: () => void
}) => {
  const { plan, pending_change: pendingChange } = subscription
  const scheduledPlan = pendingChange
    ? plans.find((p) => p.product_id === pendingChange.product_id)
    : null

  const intervalLabel = subscription.recurring_interval ?? 'period'
  const status = subscription.status

  return (
    <Box
      display="flex"
      flexDirection="column"
      rowGap="2xl"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      padding="xl"
    >
      <Box
        display="flex"
        flexDirection={{ base: 'column', md: 'row' }}
        rowGap="l"
        justifyContent={{ md: 'between' }}
        alignItems={{ md: 'start' }}
      >
        <Box display="flex" flexDirection="column" rowGap="s">
          <Box display="flex" alignItems="center" columnGap="s">
            <Text variant="heading-xxs" as="h3">
              {plan.name}
            </Text>
            <Pill color={STATUS_COLOR[status] ?? 'blue'}>
              {STATUS_LABEL[status] ?? status}
            </Pill>
            {scheduledPlan && (
              <Pill color="yellow">Switches to {scheduledPlan.name}</Pill>
            )}
            {subscription.cancel_at_period_end && (
              <Pill color="yellow">Cancels at period end</Pill>
            )}
          </Box>
          {plan.description && <Text color="muted">{plan.description}</Text>}
        </Box>
        <Box
          display="flex"
          flexDirection="column"
          rowGap="xs"
          alignItems={{ base: 'start', md: 'end' }}
        >
          <Box display="flex" alignItems="baseline" columnGap="xs">
            <Text variant="heading-xs" as="span">
              {subscription.amount === 0
                ? 'Free'
                : formatPrice(subscription.amount, subscription.currency)}
            </Text>
            {subscription.amount > 0 && (
              <Text color="muted" as="span">
                / {intervalLabel}
              </Text>
            )}
          </Box>
          {plan.transaction_fee && (
            <Text color="muted" align="right">
              {formatFee(plan.transaction_fee)} per transaction
            </Text>
          )}
        </Box>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }}
        gap="xl"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        paddingTop="xl"
      >
        {subscription.started_at && (
          <Detail label="Started">
            <FormattedDateTime datetime={subscription.started_at} />
          </Detail>
        )}
        <Detail
          label={subscription.cancel_at_period_end ? 'Ends on' : 'Renews on'}
        >
          <FormattedDateTime datetime={subscription.current_period_end} />
        </Detail>
      </Box>

      {scheduledPlan && pendingChange && (
        <Box
          display="flex"
          flexDirection="column"
          rowGap="m"
          columnGap="m"
          borderRadius="m"
          alignItems="start"
          backgroundColor="background-card"
          padding="l"
        >
          <Box display="flex" flexDirection="column" columnGap="s">
            <Text variant="body" as="h3">
              Plan change scheduled
            </Text>
            <Text color="muted">
              Your plan will switch from {plan.name} to {scheduledPlan.name} on{' '}
              <FormattedDateTime datetime={pendingChange.applies_at} />.
            </Text>
          </Box>
        </Box>
      )}

      <Box
        display="flex"
        flexDirection="row"
        flexWrap="wrap"
        columnGap="m"
        rowGap="m"
      >
        <Button onClick={onChangePlan}>Change plan</Button>
      </Box>
    </Box>
  )
}
