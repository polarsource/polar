'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import {
  useMetrics,
  useOrganizationPaymentStatus,
} from '@/hooks/queries'
import {
  getChartRangeParams,
  getPreviousParams,
} from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'

const OVERVIEW_METRICS: {
  slug: keyof schemas['Metrics']
  display_name: string
}[] = [
  { slug: 'revenue', display_name: 'Revenue' },
  { slug: 'net_revenue', display_name: 'Net Revenue' },
  { slug: 'orders', display_name: 'Transactions' },
  { slug: 'new_subscriptions', display_name: 'New Subscriptions' },
]

interface MetricCardProps {
  organization: schemas['Organization']
  metric: keyof schemas['Metrics']
}

const MetricCard = ({ organization, metric }: MetricCardProps) => {
  const [startDate, endDate, interval] = React.useMemo(
    () => getChartRangeParams('30d', organization.created_at),
    [organization.created_at],
  )

  const { data, isLoading } = useMetrics({
    organization_id: organization.id,
    startDate,
    endDate,
    interval,
    metrics: [metric],
  })

  const previousParams = React.useMemo(
    () => getPreviousParams(startDate, '30d'),
    [startDate],
  )

  const { data: previousData } = useMetrics(
    {
      organization_id: organization.id,
      startDate: previousParams ? previousParams[0] : startDate,
      endDate: previousParams ? previousParams[1] : endDate,
      interval,
      metrics: [metric],
    },
    previousParams !== null,
  )

  return (
    <MetricChartBox
      metric={metric}
      data={data}
      previousData={previousData}
      interval={interval}
      loading={isLoading}
      height={120}
      compact
      shareable={false}
      simple
      chartType="line"
    />
  )
}

interface AccountSetupBannerProps {
  organization: schemas['Organization']
}

const AccountSetupBanner = ({ organization }: AccountSetupBannerProps) => {
  const { data: paymentStatus, isLoading } = useOrganizationPaymentStatus(
    organization.id,
  )

  if (isLoading || !paymentStatus || paymentStatus.payment_ready) {
    return null
  }

  const completedCount = paymentStatus.steps.filter((s) => s.completed).length
  const totalCount = paymentStatus.steps.length

  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-y-1">
          <h3 className="text-lg font-medium dark:text-white">
            Activate your account
          </h3>
          <p className="dark:text-polar-400 text-sm text-gray-500">
            Complete these steps to start accepting payments and receiving
            payouts.
          </p>
        </div>
        <Link
          href={`/dashboard/${organization.slug}/finance/account`}
        >
          <Button size="sm">
            Continue Setup
          </Button>
        </Link>
      </div>

      {/* Step indicators */}
      <div className="flex flex-col gap-3">
        {/* Progress bar */}
        <div className="dark:bg-polar-700 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {paymentStatus.steps.map((step, i) => (
            <div
              key={step.id}
              className={twMerge(
                'flex items-center gap-x-2.5 rounded-lg px-3 py-2 text-sm',
                step.completed
                  ? 'dark:text-polar-400 text-gray-500'
                  : 'dark:text-white text-gray-900',
              )}
            >
              {step.completed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="dark:text-polar-500 h-4 w-4 shrink-0 text-gray-300" />
              )}
              <span className={step.completed ? 'line-through' : ''}>
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface OverviewPageProps {
  organization: schemas['Organization']
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  const motionVariants = {
    variants: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.3 } },
      exit: { opacity: 0, transition: { duration: 0.3 } },
    },
  }

  return (
    <DashboardBody className="gap-y-8 pb-16 md:gap-y-10">
      {/* Account setup banner — disappears when payment_ready */}
      <AccountSetupBanner organization={organization} />

      {/* Metric chart cards — Stripe-style 2x2 grid with sparklines */}
      <motion.div
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ staggerChildren: 0.06 }}
      >
        {OVERVIEW_METRICS.map((m) => (
          <motion.div key={m.slug} {...motionVariants}>
            <MetricCard organization={organization} metric={m.slug} />
          </motion.div>
        ))}
      </motion.div>

      {/* Recent transactions */}
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <motion.div {...motionVariants}>
          <OrdersWidget />
        </motion.div>
      </motion.div>
    </DashboardBody>
  )
}
