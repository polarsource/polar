'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { toast } from '@/components/Toast/use-toast'
import { usePostHog } from '@/hooks/posthog'
import {
  useCancelSubscription,
  useChangeSubscriptionPlan,
  useOrganizationPlans,
  useOrganizationSubscription,
  useStartSubscriptionCheckout,
} from '@/hooks/queries/billing'
import { useBillingPlanTelemetry } from '@/hooks/useBillingPlanTelemetry'
import { extractApiErrorMessage } from '@/utils/api/errors'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { PlanCard } from './PlanCard'

const FREE_PLAN_KEY = '__free__'
const planKey = (plan: schemas['OrganizationPlan']) =>
  plan.product_id ?? FREE_PLAN_KEY

// Statuses for which plan changes are available: active orgs and orgs still
// pending approval (under review or snoozed).
const PLAN_CHANGE_STATUSES: schemas['OrganizationStatus'][] = [
  'active',
  'review',
  'snoozed',
]

export default function ChangePlanPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const posthog = usePostHog()
  const { buildUrls } = useBillingPlanTelemetry({
    source: 'change_plan',
    organizationId: organization.id,
    successPath: `/dashboard/${organization.slug}/settings/billing`,
  })
  const subscriptionQuery = useOrganizationSubscription(organization.id)
  const plansQuery = useOrganizationPlans(organization.id)
  const changePlan = useChangeSubscriptionPlan(organization.id)
  const cancelSubscription = useCancelSubscription(organization.id)
  const startCheckout = useStartSubscriptionCheckout(organization.id)

  const blockChanges = !PLAN_CHANGE_STATUSES.includes(organization.status)

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const {
    isShown: isConfirmShown,
    show: showConfirm,
    hide: hideConfirm,
  } = useModal()

  const billingHref = `/dashboard/${organization.slug}/settings/billing?checkout_success=true`
  const subscription = subscriptionQuery.data
  const isCurrentPlanCustom = subscription?.plan.custom === true
  const plans = useMemo(() => {
    const data = plansQuery.data ?? []
    if (!subscription) return data
    if (isCurrentPlanCustom) return [subscription.plan]
    const currentInList = data.some(
      (p) => planKey(p) === planKey(subscription.plan),
    )
    return currentInList ? data : [...data, subscription.plan]
  }, [plansQuery.data, subscription, isCurrentPlanCustom])
  // Use the plan's base price (not subscription.amount, which is the
  // post-discount net) so a 100%-discounted paid plan isn't mistaken for the
  // free plan — that misroutes downgrades through start_checkout and 422s.
  const isCurrentPlanFree = (subscription?.plan.price?.amount ?? 0) === 0

  const selectedPlan = useMemo(() => {
    if (selectedPlanId === null) return null
    return (
      plans.find((p) => (p.product_id ?? FREE_PLAN_KEY) === selectedPlanId) ??
      null
    )
  }, [plans, selectedPlanId])

  const isSelectedPlanFree = (selectedPlan?.price?.amount ?? 0) === 0

  const changeKind: 'upgrade' | 'downgrade' | null = useMemo(() => {
    if (!selectedPlan || !subscription) return null
    // Compare gross plan prices, not subscription.amount — subscription.amount
    // is the post-discount net (0 for a 100%-discounted Scale plan), which
    // mislabels downgrades as upgrades.
    const targetAmount = selectedPlan.price?.amount ?? 0
    const currentAmount = subscription.plan.price?.amount ?? 0
    if (targetAmount > currentAmount) return 'upgrade'
    if (targetAmount < currentAmount) return 'downgrade'
    return null
  }, [selectedPlan, subscription])

  const requiresCheckout =
    isCurrentPlanFree && (selectedPlan?.price?.amount ?? 0) > 0

  const isSubmitting =
    changePlan.isPending ||
    cancelSubscription.isPending ||
    startCheckout.isPending

  const confirmDescription = useMemo(() => {
    if (!selectedPlan) return ''
    let base: string
    if (requiresCheckout) {
      base = `You'll be redirected to checkout to add a payment method and complete the upgrade to ${selectedPlan.name}.`
    } else if (isSelectedPlanFree) {
      base = `Your subscription will be canceled at the end of the current period. You'll then be on the free plan with standard transaction fees.`
    } else if (changeKind === 'upgrade') {
      base = `You'll be charged a prorated amount for the rest of the current period and switched to ${selectedPlan.name}.`
    } else {
      base = `Your plan will switch to ${selectedPlan.name} at the end of the current period.`
    }
    // Discounts are scoped to a product and don't follow a plan switch.
    // Warn the admin so they don't expect the discount to carry over.
    if (
      subscription?.discount != null &&
      subscription.product_id !== selectedPlan.product_id
    ) {
      base += ` Your current ${subscription.discount.name} discount will be removed.`
    }
    return base
  }, [
    selectedPlan,
    subscription,
    changeKind,
    requiresCheckout,
    isSelectedPlanFree,
  ])

  const performPlanChange = async () => {
    if (!selectedPlan) return

    if (requiresCheckout) {
      if (!selectedPlan.product_id) return
      posthog.capture('dashboard:subscriptions:checkout:start', {
        organization_id: organization.id,
        source: 'change_plan',
        plan_name: selectedPlan.name,
        plan_product_id: selectedPlan.product_id,
        plan_amount_cents: selectedPlan.price?.amount ?? null,
      })
      const urls = buildUrls({
        plan_name: selectedPlan.name,
        plan_product_id: selectedPlan.product_id,
        from_plan_name: subscription?.plan.name ?? null,
        from_plan_product_id: subscription?.product_id ?? null,
        from_plan_amount_cents: subscription?.amount ?? null,
      })
      const result = await startCheckout.mutateAsync({
        product_id: selectedPlan.product_id,
        success_url: urls.success_url,
        return_url: urls.return_url,
      })
      if (result.error || !result.data) {
        toast({
          title: 'Could not start checkout',
          description: extractApiErrorMessage(
            result.error,
            'Please try again.',
          ),
        })
        return
      }
      window.location.href = result.data.url
      return
    }

    if (isSelectedPlanFree) {
      const result = await cancelSubscription.mutateAsync()
      if (result.error) {
        toast({
          title: 'Could not cancel subscription',
          description: 'Please try again.',
        })
        return
      }
      posthog.capture('dashboard:subscriptions:plan:cancel', {
        organization_id: organization.id,
        source: 'change_plan',
        from_plan_name: subscription?.plan.name ?? null,
        from_plan_product_id: subscription?.product_id ?? null,
        from_plan_amount_cents: subscription?.amount ?? null,
      })
      toast({
        title: 'Subscription cancellation scheduled',
        description:
          "Your subscription will end at the close of the current period. You'll be on the free plan after that.",
      })
      router.push(billingHref)
      return
    }

    if (!selectedPlan.product_id) return
    const result = await changePlan.mutateAsync({
      product_id: selectedPlan.product_id,
    })
    if (result.error) {
      toast({
        title: 'Could not change plan',
        description: extractApiErrorMessage(result.error, 'Please try again.'),
      })
      return
    }
    posthog.capture('dashboard:subscriptions:plan:update', {
      organization_id: organization.id,
      source: 'change_plan',
      change_kind: changeKind ?? null,
      from_plan_name: subscription?.plan.name ?? null,
      from_plan_product_id: subscription?.product_id ?? null,
      from_plan_amount_cents: subscription?.amount ?? null,
      to_plan_name: selectedPlan.name,
      to_plan_product_id: selectedPlan.product_id ?? null,
      to_plan_amount_cents: selectedPlan.price?.amount ?? null,
    })
    toast({
      title:
        changeKind === 'downgrade' ? 'Plan change scheduled' : 'Plan changed',
      description: `You're now on the ${selectedPlan.name} plan.`,
    })
    router.push(billingHref)
  }

  const ctaLabel = requiresCheckout
    ? 'Continue to checkout'
    : isSelectedPlanFree
      ? 'Cancel subscription'
      : changeKind === 'upgrade'
        ? 'Upgrade plan'
        : changeKind === 'downgrade'
          ? 'Downgrade plan'
          : 'Confirm'

  return (
    <DashboardBody title={null} wide>
      <Box flexDirection="column" rowGap="2xl">
        <Box flexDirection="column" rowGap="l">
          <Link
            href={billingHref}
            className="dark:text-polar-400 dark:hover:text-polar-200 inline-flex w-fit items-center gap-x-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowBackOutlined fontSize="inherit" />
            <span>Back to Billing</span>
          </Link>
          <Box flexDirection="column" rowGap="s">
            <Text variant="heading-s" as="h1">
              Change plan
            </Text>
            <Text color="muted">
              {isCurrentPlanCustom
                ? 'You are on a custom plan. Send an email to support to change plan or discuss terms.'
                : 'Pick a new plan for your Polar subscription. You can change again at any time.'}
            </Text>
          </Box>
        </Box>

        {plansQuery.isLoading || subscriptionQuery.isLoading ? (
          <LoadingBox height={320} borderRadius="m" />
        ) : (
          <Box
            display="grid"
            gridTemplateColumns={{
              base: '1fr',
              md: 'repeat(2, 1fr)',
              xl: 'repeat(4, 1fr)',
            }}
            gridTemplateRows="repeat(3, auto)"
            gap="l"
          >
            {plans.map((plan) => {
              const key = planKey(plan)
              const currentKey = subscription
                ? planKey(subscription.plan)
                : null
              // Highlight the Scale plan with "Free for 12 months" when the
              // org has an unclaimed Startup Program invitation.
              const isStartupProgramTarget =
                subscription?.startup_program_status === 'invited' &&
                subscription.startup_program_scale_product_id != null &&
                plan.product_id ===
                  subscription.startup_program_scale_product_id
              return (
                <PlanCard
                  key={key}
                  plan={plan}
                  isCurrent={key === currentKey}
                  isLocked={blockChanges}
                  isSelected={key === selectedPlanId}
                  onSelect={() => setSelectedPlanId(key)}
                  startupProgramOffer={
                    isStartupProgramTarget ? { monthsFree: 12 } : undefined
                  }
                />
              )
            })}
          </Box>
        )}

        {blockChanges && (
          <Box
            display="block"
            borderRadius="m"
            backgroundColor="background-warning"
            padding="l"
          >
            <Text>
              Your organization must{' '}
              <Link
                href={`/dashboard/${organization.slug}/finance/account`}
                className="underline"
              >
                complete the account review
              </Link>{' '}
              and be approved before changing plan.
            </Text>
          </Box>
        )}

        {selectedPlan && (
          <Box flexDirection="row-reverse" columnGap="s">
            <Button
              onClick={showConfirm}
              disabled={isSubmitting || blockChanges}
              loading={isSubmitting}
              size="lg"
            >
              {ctaLabel}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => router.push(billingHref)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </Box>
        )}
      </Box>

      <ConfirmModal
        isShown={isConfirmShown}
        hide={hideConfirm}
        title={ctaLabel}
        description={confirmDescription}
        onConfirm={performPlanChange}
      />
    </DashboardBody>
  )
}
