'use client'

import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Pill } from '@polar-sh/orbit'
import { getSubscriptionStatusColor } from '@/components/Subscriptions/utils'

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

const Detail = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <Box flexDirection="column" rowGap="xs">
    <Text color="muted">{label}</Text>
    <Text>{children}</Text>
  </Box>
)

const formatFee = (fee: schemas['OrganizationPlanFee']) => {
  const percent = (fee.percent / 100).toFixed(2)
  const fixed = (fee.fixed / 100).toFixed(2)
  return `${percent}% + $${fixed}`
}

type SubscriptionDiscount = NonNullable<
  schemas['OrganizationSubscription']['discount']
>

const formatDiscountAmount = (discount: SubscriptionDiscount) => {
  if (discount.type === 'percentage' && discount.basis_points != null) {
    const pct = discount.basis_points / 100
    return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}% off`
  }
  if (discount.type === 'fixed' && discount.amounts) {
    const entry = Object.entries(discount.amounts)[0]
    if (entry) {
      const [currency, amount] = entry
      return `${formatPrice(amount, currency)} off`
    }
  }
  return discount.name
}

const formatDiscountDuration = (discount: SubscriptionDiscount) => {
  if (discount.duration === 'forever') return 'Applies forever'
  if (discount.duration === 'once') return 'Applies to the first invoice only'
  if (discount.duration === 'repeating' && discount.duration_in_months) {
    const months = discount.duration_in_months
    return `Applies for ${months} month${months === 1 ? '' : 's'}`
  }
  return ''
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
  const status = subscription.status as schemas['SubscriptionStatus']

  return (
    <Box
      flexDirection="column"
      rowGap="2xl"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      padding="xl"
    >
      <Box
        flexDirection={{ base: 'column', md: 'row' }}
        rowGap="l"
        justifyContent={{ md: 'between' }}
        alignItems={{ md: 'start' }}
      >
        <Box flexDirection="column" rowGap="s">
          <Box alignItems="center" columnGap="m">
            <Text variant="heading-xxs" as="h3">
              {plan.name}
            </Text>
            <Pill color={getSubscriptionStatusColor(status)}>
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
          flexDirection="column"
          rowGap="xs"
          alignItems={{ base: 'start', md: 'end' }}
        >
          <Box alignItems="baseline" columnGap="xs">
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

      {(subscription.started_at || subscription.current_period_end) && (
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
          {subscription.current_period_end && (
            <Detail
              label={
                subscription.cancel_at_period_end ? 'Ends on' : 'Renews on'
              }
            >
              <FormattedDateTime datetime={subscription.current_period_end} />
            </Detail>
          )}
        </Box>
      )}

      {subscription.discount && (
        <Box
          flexDirection="column"
          rowGap="s"
          borderRadius="m"
          alignItems="start"
          backgroundColor="background-card"
          padding="l"
        >
          <Box alignItems="center" columnGap="l">
            <Text variant="body" as="h3">
              {subscription.discount.name}
            </Text>
            <Pill color="green">
              {formatDiscountAmount(subscription.discount)}
            </Pill>
          </Box>
          <Text color="muted">
            {formatDiscountDuration(subscription.discount)}
            {subscription.discount.ends_at && (
              <>
                {' until '}
                <FormattedDateTime datetime={subscription.discount.ends_at} />
              </>
            )}
          </Text>
        </Box>
      )}

      {scheduledPlan && pendingChange && (
        <Box
          flexDirection="column"
          rowGap="m"
          columnGap="m"
          borderRadius="m"
          alignItems="start"
          backgroundColor="background-card"
          padding="l"
        >
          <Box flexDirection="column" columnGap="s">
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

      <Box flexDirection="row" flexWrap="wrap" columnGap="m" rowGap="m">
        <Button onClick={onChangePlan}>Change plan</Button>
      </Box>
    </Box>
  )
}
