'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import {
  BILLING_PLANS,
  BillingPlan,
  BillingPlanId,
} from '@/components/Settings/Billing/mockData'
import {
  applyPlanChange,
  schedulePlanChange,
  useBillingSubscription,
} from '@/components/Settings/Billing/useBillingStore'
import { toast } from '@/components/Toast/use-toast'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { formatCurrency } from '@polar-sh/currency'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const formatPrice = formatCurrency('standard', 'en-US')

const PlanCard = ({
  plan,
  isCurrent,
  isSelected,
  onSelect,
}: {
  plan: BillingPlan
  isCurrent: boolean
  isSelected: boolean
  onSelect: () => void
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isCurrent}
      className={twMerge(
        'dark:border-polar-700 flex h-full flex-col gap-y-8 rounded-2xl border bg-white p-8 text-left transition-colors dark:bg-transparent',
        isCurrent
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
        <Text color="muted">{plan.description}</Text>
      </Box>

      <Box display="flex" flexDirection="column" rowGap="s">
        <Box display="flex" alignItems="baseline" columnGap="m">
          <Text variant="heading-s" as="span">
            {plan.contactSales
              ? 'Custom'
              : plan.amount === 0
                ? 'Free'
                : formatPrice(plan.amount, plan.currency)}
          </Text>
          {!plan.contactSales && plan.amount > 0 && (
            <Text color="muted" as="span">
              / {plan.interval}
            </Text>
          )}
        </Box>
        {plan.fees.length > 0 && (
          <Box as="ul" display="flex" flexDirection="column">
            {plan.fees.map((fee) => (
              <Box as="li" key={fee}>
                <Text color="muted">{fee} per transaction</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>

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
        {plan.features.map((feature) => (
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
    </button>
  )
}

export default function ChangePlanPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const subscription = useBillingSubscription()
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlanId | null>(
    null,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const {
    isShown: isConfirmShown,
    show: showConfirm,
    hide: hideConfirm,
  } = useModal()

  const billingHref = `/dashboard/${organization.slug}/settings/billing`

  const selectablePlans = useMemo(
    () => BILLING_PLANS.filter((p) => !p.contactSales),
    [],
  )
  const enterprisePlan = useMemo(
    () => BILLING_PLANS.find((p) => p.contactSales),
    [],
  )

  const currentPlan = useMemo(
    () => BILLING_PLANS.find((p) => p.id === subscription.planId),
    [subscription.planId],
  )

  const selectedPlan = useMemo(
    () => BILLING_PLANS.find((p) => p.id === selectedPlanId) ?? null,
    [selectedPlanId],
  )

  const changeKind: 'upgrade' | 'downgrade' | null = useMemo(() => {
    if (!selectedPlan || !currentPlan) return null
    if (selectedPlan.amount > currentPlan.amount) return 'upgrade'
    if (selectedPlan.amount < currentPlan.amount) return 'downgrade'
    return null
  }, [selectedPlan, currentPlan])

  const confirmDescription = useMemo(() => {
    if (!selectedPlan || !currentPlan || !changeKind) return ''
    if (changeKind === 'upgrade') {
      return `You'll be charged a prorated amount for the rest of the current period and ${formatPrice(
        selectedPlan.amount,
        selectedPlan.currency,
      )} per ${selectedPlan.interval} thereafter.`
    }
    return `Your ${currentPlan.name} plan will remain active until the end of the current period, then switch to ${selectedPlan.name}.`
  }, [selectedPlan, currentPlan, changeKind])

  const performPlanChange = async () => {
    if (!selectedPlanId || !selectedPlan || !changeKind) return
    setIsSubmitting(true)
    // Simulate API latency for the mocked flow.
    await new Promise((resolve) => setTimeout(resolve, 600))
    if (changeKind === 'upgrade') {
      applyPlanChange(selectedPlanId)
      toast({
        title: 'Plan upgraded',
        description: `You're now on the ${selectedPlan.name} plan.`,
      })
    } else {
      schedulePlanChange(selectedPlanId, subscription.currentPeriodEnd)
      toast({
        title: 'Downgrade scheduled',
        description: `You'll move to ${selectedPlan.name} at the end of the current period.`,
      })
    }
    setIsSubmitting(false)
    router.push(billingHref)
  }

  const onContactSales = () => {
    toast({
      title: 'Request received',
      description:
        'Our sales team will be in touch shortly to discuss Enterprise pricing.',
    })
  }

  const ctaLabel =
    changeKind === 'upgrade'
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
              Pick a new plan for your Polar subscription. You can change again
              at any time.
            </Text>
          </Box>
        </Box>

        {enterprisePlan && (
          <Box
            display="flex"
            flexDirection={{ base: 'column', md: 'row' }}
            alignItems={{ base: 'start', md: 'center' }}
            justifyContent="between"
            rowGap="l"
            columnGap="l"
            borderRadius="l"
            backgroundColor="background-card"
            padding="xl"
          >
            <Box display="flex" flexDirection="column" rowGap="xs">
              <Text variant="heading-xxs" as="h3">
                Need something custom?
              </Text>
              <Text color="muted">
                Talk to our team about Enterprise pricing, volume discounts, and
                tailored contracts.
              </Text>
            </Box>
            <Button variant="secondary" onClick={onContactSales}>
              Contact sales
            </Button>
          </Box>
        )}

        <Box
          display="grid"
          gridTemplateColumns={{
            base: '1fr',
            md: 'repeat(2, 1fr)',
            xl: 'repeat(4, 1fr)',
          }}
          gap="l"
        >
          {selectablePlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === subscription.planId}
              isSelected={plan.id === selectedPlanId}
              onSelect={() => setSelectedPlanId(plan.id)}
            />
          ))}
        </Box>

        <Box display="flex" flexDirection="row" columnGap="s">
          <Button
            onClick={showConfirm}
            disabled={!changeKind || isSubmitting}
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
