'use client'

import { toast } from '@/components/Toast/use-toast'
import { usePostHog } from '@/hooks/posthog'
import { useClaimStartupProgram } from '@/hooks/queries/billing'
import { useBillingPlanTelemetry } from '@/hooks/useBillingPlanTelemetry'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'

/**
 * Callout shown on the billing page when the organization is invited to the
 * Startup Program but isn't on the Scale plan yet. Clicking the CTA hits a
 * single backend endpoint that dispatches:
 *
 * - **Free → Scale**: the response carries a `checkout` to redirect to
 *   (regular Polar checkout to set up payment; the discount is already
 *   attached).
 * - **Paid → Scale**: the response carries a `subscription` — the existing
 *   paid subscription was switched to Scale with the discount applied via
 *   PATCH, no checkout step required.
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
  const claim = useClaimStartupProgram(organization.id)
  const { buildUrls } = useBillingPlanTelemetry({
    source: 'startup_program',
    organizationId: organization.id,
    successPath: `/dashboard/${organization.slug}/settings/billing`,
  })

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
    const result = await claim.mutateAsync({
      success_url: urls.success_url,
      return_url: urls.return_url,
    })
    if (result.error || !result.data) {
      toast({
        title: 'Could not switch to Scale',
        description: extractApiErrorMessage(result.error, 'Please try again.'),
      })
      return
    }
    // Free → Scale: redirect through Polar checkout (discount pre-attached).
    if (result.data.checkout) {
      window.location.href = result.data.checkout.url
      return
    }
    // Paid → Scale: subscription switched + discount applied in place.
    toast({
      title: `You're on ${planName}`,
      description: 'Your discount is now applied.',
    })
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
          months. The discount applies automatically.
        </Text>
      </Box>
      <Button onClick={onClaim} loading={claim.isPending}>
        Switch to Scale
      </Button>
    </Box>
  )
}
