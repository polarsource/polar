'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { toast } from '@/components/Toast/use-toast'
import {
  useCancelSubscription,
  useChangeSubscriptionPlan,
  useOrganizationPlans,
  useOrganizationSubscription,
  useStartSubscriptionCheckout,
} from '@/hooks/queries/billing'
import { extractApiErrorMessage } from '@/utils/api/errors'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const formatPrice = formatCurrency('standard', 'en-US')

const formatFee = (fee: schemas['OrganizationPlanFee']) =>
  `${(fee.percent / 100).toFixed(2)}% + $${(fee.fixed / 100).toFixed(2)}`

const FREE_PLAN_KEY = '__free__'
const planKey = (plan: schemas['OrganizationPlan']) =>
  plan.product_id ?? FREE_PLAN_KEY

const PlanCard = ({
  plan,
  isCurrent,
  isSelected,
  isLocked,
  onSelect,
}: {
  plan: schemas['OrganizationPlan']
  isCurrent: boolean
  isSelected: boolean
  isLocked: boolean
  onSelect: () => void
}) => {
  const amount = plan.price?.amount ?? 0
  const currency = plan.price?.currency ?? 'usd'
  const disabled = isCurrent || isLocked
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={twMerge(
        'dark:border-polar-700 flex h-full flex-col gap-y-8 rounded-2xl border bg-white p-8 text-left transition-colors dark:bg-transparent',
        disabled
          ? 'dark:bg-polar-800 cursor-not-allowed border-gray-200 bg-gray-50 opacity-70'
          : isSelected
            ? 'border-blue-500 bg-blue-50/40 dark:border-blue-500 dark:bg-blue-950/20'
            : 'cursor-pointer hover:border-gray-300 dark:hover:border-polar-600',
      )}
    >
      <Box display="flex" flexDirection="column" rowGap="s">
        <Box display="flex" alignItems="center" columnGap="s">
          <Text variant="heading-xs" as="h3">
            {plan.name}
          </Text>
          {isCurrent && <Pill color="gray">Current</Pill>}
          {plan.highlight && !isCurrent && <Pill color="blue">Popular</Pill>}
        </Box>
        {plan.description && <Text color="muted">{plan.description}</Text>}
      </Box>

      <Box display="flex" flexDirection="column" rowGap="s">
        <Box display="flex" alignItems="baseline" columnGap="m">
          <Text variant="heading-s" as="span">
            {amount === 0 ? 'Free' : formatPrice(amount, currency)}
          </Text>
          {amount > 0 && plan.recurring_interval && (
            <Text color="muted" as="span">
              / {plan.recurring_interval}
            </Text>
          )}
        </Box>
        {plan.transaction_fee && (
          <Text color="muted">
            {formatFee(plan.transaction_fee)} per transaction
          </Text>
        )}
      </Box>

      {(plan.features?.length ?? 0) > 0 && (
        <Box
          as="ul"
          display="flex"
          flexDirection="column"
          rowGap="s"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          paddingTop="2xl"
        >
          {plan.features?.map((feature) => (
            <Box
              as="li"
              key={feature}
              display="flex"
              alignItems="start"
              columnGap="s"
            >
              <CheckOutlined
                className="mt-0.5 text-blue-500"
                fontSize="inherit"
              />
              <Text as="span">{feature}</Text>
            </Box>
          ))}
        </Box>
      )}
    </button>
  )
}

export default function ChangePlanPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const subscriptionQuery = useOrganizationSubscription(organization.id)
  const plansQuery = useOrganizationPlans(organization.id)
  const changePlan = useChangeSubscriptionPlan(organization.id)
  const cancelSubscription = useCancelSubscription(organization.id)
  const startCheckout = useStartSubscriptionCheckout(organization.id)

  const blockChanges = organization.status !== 'active'

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
  const isCurrentPlanFree = subscription?.amount === 0

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
    const targetAmount = selectedPlan.price?.amount ?? 0
    if (targetAmount > subscription.amount) return 'upgrade'
    if (targetAmount < subscription.amount) return 'downgrade'
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
    if (requiresCheckout) {
      return `You'll be redirected to checkout to add a payment method and complete the upgrade to ${selectedPlan.name}.`
    }
    if (isSelectedPlanFree) {
      return `Your subscription will be canceled at the end of the current period. You'll then be on the free plan with standard transaction fees.`
    }
    if (changeKind === 'upgrade') {
      return `You'll be charged a prorated amount for the rest of the current period and switched to ${selectedPlan.name}.`
    }
    return `Your plan will switch to ${selectedPlan.name} at the end of the current period.`
  }, [selectedPlan, changeKind, requiresCheckout, isSelectedPlanFree])

  const performPlanChange = async () => {
    if (!selectedPlan) return

    if (requiresCheckout) {
      if (!selectedPlan.product_id) return
      const result = await startCheckout.mutateAsync({
        product_id: selectedPlan.product_id,
        success_url: `${window.location.origin}${billingHref}`,
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
      <Box display="flex" flexDirection="column" rowGap="2xl">
        <Box display="flex" flexDirection="column" rowGap="l">
          <Link
            href={billingHref}
            className="dark:text-polar-400 dark:hover:text-polar-200 inline-flex w-fit items-center gap-x-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowBackOutlined fontSize="inherit" />
            <span>Back to Billing</span>
          </Link>
          <Box display="flex" flexDirection="column" rowGap="s">
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
            gap="l"
          >
            {plans.map((plan) => {
              const key = planKey(plan)
              const currentKey = subscription
                ? planKey(subscription.plan)
                : null
              return (
                <PlanCard
                  key={key}
                  plan={plan}
                  isCurrent={key === currentKey}
                  isSelected={key === selectedPlanId}
                  onSelect={() => setSelectedPlanId(key)}
                />
              )
            })}
          </Box>
        )}

        {blockChanges && (
          <Box
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

        <Box display="flex" flexDirection="row" columnGap="s">
          <Button
            onClick={showConfirm}
            disabled={!selectedPlan || isSubmitting || blockChanges}
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
