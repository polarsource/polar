'use client'

import { toast } from '@/components/Toast/use-toast'
import { usePostHog } from '@/hooks/posthog'
import { useStartSubscriptionCheckout } from '@/hooks/queries/billing'
import { useBillingPlanTelemetry } from '@/hooks/useBillingPlanTelemetry'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'

/**
 * Callout shown on the billing page when the organization is eligible for the
 * Polar Startup Program but isn't on the Scale plan yet. Clicking the CTA
 * starts the Scale checkout directly (with the 100% discount auto-attached
 * server-side via start_checkout) instead of routing through the change-plan
 * page.
 */
export const StartupProgramCallout = ({
  organization,
  subscription,
  plans,
}: {
  organization: schemas['Organization']
  subscription: schemas['OrganizationSubscription']
  plans: schemas['OrganizationPlan'][]
}) => {
  const scaleProductId = subscription.startup_program_scale_product_id
  const isInvited = subscription.startup_program_status === 'invited'
  const alreadyOnScale =
    scaleProductId != null && subscription.product_id === scaleProductId

  const posthog = usePostHog()
  const startCheckout = useStartSubscriptionCheckout(organization.id)
  const { buildUrls } = useBillingPlanTelemetry({
    source: 'startup_program',
    organizationId: organization.id,
    successPath: `/dashboard/${organization.slug}/settings/billing`,
  })

  console.log({ isInvited, scaleProductId, alreadyOnScale })

  if (!isInvited || !scaleProductId || alreadyOnScale) {
    return null
  }

  const scalePlan = plans.find((plan) => plan.product_id === scaleProductId)
  const planName = scalePlan?.name ?? 'Scale'
  const planAmountCents = scalePlan?.price?.amount ?? null

  const onClaim = async () => {
    posthog.capture('dashboard:subscriptions:checkout:start', {
      organization_id: organization.id,
      source: 'startup_program',
      plan_name: planName,
      plan_product_id: scaleProductId,
      plan_amount_cents: planAmountCents,
      from_plan_name: subscription.plan.name,
      from_plan_product_id: subscription.product_id ?? null,
      from_plan_amount_cents: subscription.amount,
    })
    const urls = buildUrls({
      plan_name: planName,
      plan_product_id: scaleProductId,
      from_plan_name: subscription.plan.name,
      from_plan_product_id: subscription.product_id ?? null,
      from_plan_amount_cents: subscription.amount,
    })
    const result = await startCheckout.mutateAsync({
      product_id: scaleProductId,
      success_url: urls.success_url,
      return_url: urls.return_url,
    })
    if (result.error || !result.data) {
      toast({
        title: 'Could not start checkout',
        description: extractApiErrorMessage(result.error, 'Please try again.'),
      })
      return
    }
    window.location.href = result.data.url
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent={{ md: 'between' }}
      alignItems="start"
      rowGap="xl"
      columnGap="l"
      borderRadius="l"
      backgroundColor="background-card"
      padding="xl"
    >
      <Box display="flex" flexDirection="column" rowGap="xs">
        <Text variant="body" as="h3">
          You&apos;re in the Polar Startup Program
        </Text>
        <Text color="muted">
          Switch to the Scale plan to claim your 100% discount for the next 12
          months. The discount applies automatically at checkout.
        </Text>
      </Box>
      <Button onClick={onClaim} loading={startCheckout.isPending}>
        Switch to Scale
      </Button>
    </Box>
  )
}
