'use client'

import { toast } from '@/components/Toast/use-toast'
import { useMetrics } from '@/hooks/queries'
import {
  useOrganizationPlans,
  useOrganizationSubscription,
  useStartSubscriptionCheckout,
} from '@/hooks/queries/billing'
import { useHasPermission } from '@/hooks/permissions'
import { extractApiErrorMessage } from '@/utils/api/errors'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { subDays } from 'date-fns'
import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { CycleArrow } from '../Landing/graphics/CycleArrow'

const DISMISSED_KEY = 'plan_upsell_dismissed'

interface PlanUpsellProps {
  organization: schemas['Organization']
}

interface Recommendation {
  plan: schemas['OrganizationPlan']
  savings: number
}

const getIsDismissed = (): boolean => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DISMISSED_KEY) === 'true'
}

const monthlyPlanCost = (plan: schemas['OrganizationPlan']): number | null => {
  if (!plan.price?.amount) return null
  if (plan.recurring_interval === 'year') {
    return Math.round(plan.price.amount / 12)
  }
  return plan.price.amount
}

const computeSavings = (
  revenue: number,
  orders: number,
  current: schemas['OrganizationPlanFee'],
  plan: schemas['OrganizationPlan'],
): number | null => {
  if (!plan.product_id || !plan.transaction_fee) return null
  const monthlyCost = monthlyPlanCost(plan)
  if (monthlyCost === null) return null
  const percentDiff = current.percent - plan.transaction_fee.percent
  const fixedDiff = current.fixed - plan.transaction_fee.fixed
  if (percentDiff <= 0) return null

  const variableSavings = Math.round((revenue * percentDiff) / 10000)
  const fixedSavings = orders * fixedDiff
  return variableSavings + fixedSavings - monthlyCost
}

const pickBest = (
  revenue: number,
  orders: number,
  current: schemas['OrganizationPlanFee'],
  plans: schemas['OrganizationPlan'][],
): Recommendation | null => {
  let best: Recommendation | null = null
  for (const plan of plans) {
    const savings = computeSavings(revenue, orders, current, plan)
    if (savings === null || savings <= 0) continue
    if (!best || savings > best.savings) {
      best = { plan, savings }
    }
  }
  return best
}

export const PlanUpsell = ({ organization }: PlanUpsellProps) => {
  const [isDismissed, setIsDismissed] = useState(getIsDismissed)
  const canManageBilling = useHasPermission(
    organization.id,
    'organization:manage',
  )
  const gatedOrgId = canManageBilling ? organization.id : undefined
  const subscriptionQuery = useOrganizationSubscription(gatedOrgId)
  const plansQuery = useOrganizationPlans(gatedOrgId)
  const startCheckout = useStartSubscriptionCheckout(organization.id)

  const { startDate, endDate } = useMemo(() => {
    const now = new Date()
    return { startDate: subDays(now, 30), endDate: now }
  }, [])

  const metricsQuery = useMetrics({
    organization_id: organization.id,
    startDate,
    endDate,
    interval: 'day',
    metrics: ['revenue', 'orders', 'monthly_recurring_revenue'],
  })

  const dismiss = useCallback(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(DISMISSED_KEY, 'true')
    setIsDismissed(true)
  }, [])

  const monthlyRevenue = Math.max(
    metricsQuery.data?.totals.revenue ?? 0,
    metricsQuery.data?.totals.monthly_recurring_revenue ?? 0,
  )

  const recommendation = useMemo<Recommendation | null>(() => {
    const subscription = subscriptionQuery.data
    const plans = plansQuery.data
    const metrics = metricsQuery.data
    if (!subscription || !plans || !metrics) return null
    if (subscription.amount > 0) return null
    if (subscription.plan.custom) return null
    if (!subscription.plan.transaction_fee) return null
    if (monthlyRevenue <= 0) return null
    const orders = metrics.totals.orders ?? 0
    return pickBest(
      monthlyRevenue,
      orders,
      subscription.plan.transaction_fee,
      plans,
    )
  }, [
    subscriptionQuery.data,
    plansQuery.data,
    metricsQuery.data,
    monthlyRevenue,
  ])

  if (isDismissed || !recommendation) return null
  if (organization.status !== 'active') return null

  const { plan, savings } = recommendation

  const upgrade = async () => {
    if (!plan.product_id) return
    const billingHref = `/dashboard/${organization.slug}/settings/billing?checkout_success=true`
    const result = await startCheckout.mutateAsync({
      product_id: plan.product_id,
      success_url: `${window.location.origin}${billingHref}`,
      return_url: window.location.href,
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
  const formatStandard = formatCurrency('standard', 'en-US')
  const formatCompact = formatCurrency('compact', 'en-US')
  const annualSavings = savings * 12
  const planPrice = plan.price?.amount ?? 0
  const planCurrency = plan.price?.currency ?? 'usd'
  const fee = plan.transaction_fee
  const feeLabel = fee
    ? `${(fee.percent / 100).toFixed(2)}% + $${(fee.fixed / 100).toFixed(2)} per transaction`
    : null

  return (
    <Box
      position="relative"
      display="grid"
      gridTemplateColumns={{
        base: '1fr',
        lg: 'repeat(3, 1fr)',
      }}
      alignItems="stretch"
      overflow="hidden"
      borderRadius="xl"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        padding="2xl"
      >
        <Box height="100%" width={240} display="flex" aspectRatio="1 / 1">
          <CycleArrow />
        </Box>
      </Box>
      <Box
        display="flex"
        flexDirection="column"
        rowGap="xl"
        padding="2xl"
        justifyContent="between"
        borderLeftWidth={{ base: 0, lg: 1 }}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box display="flex" flexDirection="column" rowGap="l">
          <Text color="success" variant="body">
            Lower your transaction fees
          </Text>
          <Text variant="heading-xxs" as="h3">
            Save {formatStandard(savings, 'usd')} /month
          </Text>
          <Text variant="body" color="muted">
            Based on {formatCompact(monthlyRevenue, 'usd')} in revenue over the
            last 30 days, {plan.name}&apos;s lower per-transaction fee would
            save you about {formatCompact(annualSavings, 'usd')} a year.
          </Text>
        </Box>
        <Box
          display="flex"
          flexDirection="row"
          alignItems="center"
          columnGap="m"
          flexWrap="wrap"
          rowGap="s"
        >
          <Button
            onClick={upgrade}
            loading={startCheckout.isPending}
            disabled={startCheckout.isPending}
          >
            Upgrade to {plan.name}
          </Button>
          <Link
            href={`/dashboard/${organization.slug}/settings/billing/change-plan`}
          >
            <Button variant="ghost">Compare plans</Button>
          </Link>
        </Box>
      </Box>
      <Box
        display="flex"
        flexDirection="column"
        rowGap="l"
        padding="2xl"
        borderLeftWidth={{ base: 0, lg: 1 }}
        borderTopWidth={{ base: 1, lg: 0 }}
        borderStyle="solid"
        borderColor="border-primary"
        justifyContent="between"
      >
        <Box display="flex" flexDirection="column" rowGap="xs">
          <Text variant="heading-xs" as="h4">
            {plan.name}
          </Text>
          {plan.description && <Text color="muted">{plan.description}</Text>}
        </Box>
        <Box display="flex" flexDirection="column" rowGap="xs">
          <Box display="flex" alignItems="baseline" columnGap="xs">
            <Text variant="heading-xs" as="span">
              {formatStandard(planPrice, planCurrency)}
            </Text>
            {plan.recurring_interval && (
              <Text color="muted" as="span">
                / {plan.recurring_interval}
              </Text>
            )}
          </Box>
          {feeLabel && <Text color="muted">{feeLabel}</Text>}
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
            paddingTop="l"
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
      </Box>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="dark:text-polar-500 dark:hover:text-polar-300 absolute top-8 right-8 cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
      >
        <CloseOutlined fontSize="small" />
      </button>
    </Box>
  )
}
