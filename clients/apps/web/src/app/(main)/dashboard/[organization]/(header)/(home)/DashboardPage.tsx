'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { MiniMetricChartBox } from '@/components/Metrics/MiniMetricChartBox'
import PaymentOnboardingStepper from '@/components/Onboarding/PaymentOnboardingStepper'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import RevenueWidget from '@/components/Widgets/RevenueWidget'
import {
  useMetrics,
  useOrganizationAccount,
  useOrganizationPaymentStatus,
  useTransactionsSummary,
} from '@/hooks/queries'
import {
  ALL_METRICS,
  getChartRangeParams,
  getPreviousParams,
} from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import {
  Card,
  CardContent,
  CardHeader,
} from '@polar-sh/ui/components/atoms/Card'
import { motion } from 'framer-motion'
import React from 'react'

interface HeroChartProps {
  organization: schemas['Organization']
}

const HeroChart = ({ organization }: HeroChartProps) => {
  const [selectedMetric, setSelectedMetric] =
    React.useState<keyof schemas['Metrics']>('revenue')
  const [startDate, endDate, interval] = React.useMemo(
    () => getChartRangeParams('30d', organization.created_at),
    [organization.created_at],
  )

  const { data: currentPeriodData, isLoading: currentPeriodLoading } =
    useMetrics({
      organization_id: organization.id,
      startDate: startDate,
      endDate: endDate,
      interval: interval,
      metrics: [selectedMetric],
    })

  const previousParams = React.useMemo(
    () => getPreviousParams(startDate, '30d'),
    [startDate],
  )

  const { data: previousPeriodData, isLoading: previousPeriodLoading } =
    useMetrics(
      {
        organization_id: organization.id,
        startDate: previousParams ? previousParams[0] : startDate,
        endDate: previousParams ? previousParams[1] : endDate,
        interval: interval,
        metrics: [selectedMetric],
      },
      previousParams !== null,
    )

  return (
    <MetricChartBox
      metric={selectedMetric}
      onMetricChange={setSelectedMetric}
      data={currentPeriodData}
      previousData={previousPeriodData}
      interval={interval}
      loading={currentPeriodLoading || previousPeriodLoading}
      chartType="line"
      availableMetrics={ALL_METRICS}
    />
  )
}

interface BalanceCardProps {
  organizationId: string
}

const BalanceCard = ({ organizationId }: BalanceCardProps) => {
  const { data: account } = useOrganizationAccount(organizationId)
  const { data: summary } = useTransactionsSummary(account?.id ?? '')

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <span className="dark:text-polar-500 text-gray-500">Balance</span>
      </CardHeader>
      <CardContent>
        <h3 className="text-2xl">
          {summary
            ? formatCurrency('statistics')(
                summary.balance.amount,
                summary.balance.currency,
              )
            : '$0'}
        </h3>
      </CardContent>
    </Card>
  )
}

interface OverviewPageProps {
  organization: schemas['Organization']
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  const { data: paymentStatus } = useOrganizationPaymentStatus(organization.id)

  const { data: todayMetrics } = useMetrics({
    organization_id: organization.id,
    startDate: new Date(),
    endDate: new Date(),
    interval: 'day',
    metrics: ['revenue', 'orders'],
  })

  const { data: subscriptionMetrics } = useMetrics({
    organization_id: organization.id,
    startDate: new Date(),
    endDate: new Date(),
    interval: 'day',
    metrics: ['active_subscriptions'],
  })

  const motionVariants = {
    variants: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.3 } },
      exit: { opacity: 0, transition: { duration: 0.3 } },
    },
  }

  return (
    <DashboardBody className="gap-y-8 pb-16 md:gap-y-10">
      {paymentStatus && !paymentStatus.payment_ready && (
        <PaymentOnboardingStepper organization={organization} />
      )}

      {/* Key metrics strip */}
      <motion.div
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ staggerChildren: 0.06 }}
      >
        <motion.div {...motionVariants}>
          <MiniMetricChartBox
            title="Today's Revenue"
            value={todayMetrics?.totals.revenue}
            metric={todayMetrics?.metrics.revenue}
          />
        </motion.div>
        <motion.div {...motionVariants}>
          <MiniMetricChartBox
            title="Transactions Today"
            value={todayMetrics?.totals.orders}
            metric={todayMetrics?.metrics.orders}
          />
        </motion.div>
        <motion.div {...motionVariants}>
          <MiniMetricChartBox
            title="Active Subscriptions"
            value={subscriptionMetrics?.totals.active_subscriptions}
            metric={subscriptionMetrics?.metrics.active_subscriptions}
          />
        </motion.div>
        <motion.div {...motionVariants}>
          <BalanceCard organizationId={organization.id} />
        </motion.div>
      </motion.div>

      {/* Hero chart */}
      <HeroChart organization={organization} />

      {/* Recent activity + Revenue trend */}
      <motion.div
        className="grid grid-cols-1 gap-6 xl:grid-cols-2"
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ staggerChildren: 0.1 }}
      >
        <motion.div className="flex h-full flex-col" {...motionVariants}>
          <OrdersWidget />
        </motion.div>
        <motion.div className="flex h-full flex-col" {...motionVariants}>
          <RevenueWidget />
        </motion.div>
      </motion.div>
    </DashboardBody>
  )
}
