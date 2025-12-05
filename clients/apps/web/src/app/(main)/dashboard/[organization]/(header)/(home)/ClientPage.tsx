'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import PaymentOnboardingStepper from '@/components/Onboarding/PaymentOnboardingStepper'
import { IOSAppBanner } from '@/components/Upsell/IOSAppBanner'
import { AccountWidget } from '@/components/Widgets/AccountWidget'
import { MonthWidget } from '@/components/Widgets/MonthWidget'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import RevenueWidget from '@/components/Widgets/RevenueWidget'
import { SubscribersWidget } from '@/components/Widgets/SubscribersWidget'
import { useMetrics, useOrganizationPaymentStatus } from '@/hooks/queries'
import {
  ALL_METRICS,
  getChartRangeParams,
  getPreviousParams,
} from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { motion } from 'framer-motion'
import React from 'react'
import { twMerge } from 'tailwind-merge'

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

interface OverviewPageProps {
  organization: schemas['Organization']
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  const { data: paymentStatus } = useOrganizationPaymentStatus(organization.id)

  const motionVariants = {
    variants: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.3 } },
      exit: { opacity: 0, transition: { duration: 0.3 } },
    },
  }
  const cardClassName = 'flex w-full flex-col h-full'

  return (
    <DashboardBody className="gap-y-8 pb-16 md:gap-y-12">
      <IOSAppBanner />
      {paymentStatus && !paymentStatus.payment_ready && (
        <PaymentOnboardingStepper organization={organization} />
      )}
      <HeroChart organization={organization} />
      <motion.div
        className="grid grid-cols-1 gap-6 md:gap-10 xl:grid-cols-3"
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ staggerChildren: 0.1 }}
      >
        <motion.div className={cardClassName} {...motionVariants}>
          <MonthWidget />
        </motion.div>
        <motion.div
          className={twMerge(cardClassName, 'xl:col-span-2')}
          {...motionVariants}
        >
          <RevenueWidget />
        </motion.div>
        <motion.div className={cardClassName} {...motionVariants}>
          <OrdersWidget />
        </motion.div>
        <motion.div className={cardClassName} {...motionVariants}>
          <SubscribersWidget />
        </motion.div>
        <motion.div className={cardClassName} {...motionVariants}>
          <AccountWidget />
        </motion.div>
      </motion.div>
    </DashboardBody>
  )
}
