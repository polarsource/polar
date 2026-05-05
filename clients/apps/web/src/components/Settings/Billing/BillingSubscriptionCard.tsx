'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { formatCurrency } from '@polar-sh/currency'
import { toast } from '@/components/Toast/use-toast'
import { BILLING_PLANS, BillingPlan, BillingSubscription } from './mockData'
import { cancelScheduledPlanChange } from './useBillingStore'

const formatPrice = formatCurrency('standard', 'en-US')

const STATUS_LABEL: Record<BillingSubscription['status'], string> = {
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  trialing: 'Trial',
}

const STATUS_COLOR: Record<
  BillingSubscription['status'],
  'green' | 'yellow' | 'red' | 'blue'
> = {
  active: 'green',
  past_due: 'yellow',
  canceled: 'red',
  trialing: 'blue',
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

export const BillingSubscriptionCard = ({
  subscription,
  plan,
  onChangePlan,
}: {
  subscription: BillingSubscription
  plan: BillingPlan
  onChangePlan: () => void
}) => {
  const intervalLabel = plan.interval === 'month' ? 'month' : 'year'
  const scheduledPlan = subscription.scheduledPlanChange
    ? BILLING_PLANS.find(
        (p) => p.id === subscription.scheduledPlanChange?.planId,
      )
    : null

  const onCancelScheduledChange = () => {
    cancelScheduledPlanChange()
    toast({
      title: 'Scheduled change canceled',
      description: `You'll stay on the ${plan.name} plan.`,
    })
  }

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
            <Pill color={STATUS_COLOR[subscription.status]}>
              {STATUS_LABEL[subscription.status]}
            </Pill>
            {scheduledPlan && (
              <Pill color="yellow">Switches to {scheduledPlan.name}</Pill>
            )}
            {subscription.cancelAtPeriodEnd && (
              <Pill color="yellow">Cancels at period end</Pill>
            )}
          </Box>
          <Text color="muted">{plan.description}</Text>
        </Box>
        <Box
          display="flex"
          flexDirection="column"
          rowGap="xs"
          alignItems={{ base: 'start', md: 'end' }}
        >
          <Box display="flex" alignItems="baseline" columnGap="xs">
            <Text className="text-2xl font-medium" as="span">
              {plan.contactSales
                ? 'Custom'
                : plan.amount === 0
                  ? 'Free'
                  : formatPrice(plan.amount, plan.currency)}
            </Text>
            {!plan.contactSales && plan.amount > 0 && (
              <Text color="muted" as="span">
                / {intervalLabel}
              </Text>
            )}
          </Box>
          {plan.fees.length > 0 && (
            <Text color="muted" align="right">
              {plan.fees.join(' · ')}
            </Text>
          )}
        </Box>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }}
        gap="xl"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        paddingTop="xl"
      >
        <Detail label="Started">
          <FormattedDateTime datetime={subscription.startedAt} />
        </Detail>
        <Detail
          label={subscription.cancelAtPeriodEnd ? 'Ends on' : 'Renews on'}
        >
          <FormattedDateTime datetime={subscription.currentPeriodEnd} />
        </Detail>
        <Detail label="Payment method">
          {subscription.paymentMethod.brand} ending in{' '}
          {subscription.paymentMethod.last4}
        </Detail>
      </Box>

      {scheduledPlan && subscription.scheduledPlanChange && (
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
              Downgrade scheduled
            </Text>
            <Text color="muted">
              Your plan will switch from {plan.name} to {scheduledPlan.name} on{' '}
              <FormattedDateTime
                datetime={subscription.scheduledPlanChange.effectiveAt}
              />
              . You&apos;ll keep {plan.name} access until then.
            </Text>
          </Box>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancelScheduledChange}
          >
            Cancel change
          </Button>
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
        <Button variant="ghost" disabled>
          Update payment method
        </Button>
      </Box>
    </Box>
  )
}
