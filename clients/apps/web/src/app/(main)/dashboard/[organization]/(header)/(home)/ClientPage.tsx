'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { AccountWidget } from '@/components/Widgets/AccountWidget'
import CheckoutsWidget from '@/components/Widgets/CheckoutsWidget'
import { MonthWidget } from '@/components/Widgets/MonthWidget'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import RevenueWidget from '@/components/Widgets/RevenueWidget'
import { SubscribersWidget } from '@/components/Widgets/SubscribersWidget'
import { useMetrics } from '@/hooks/queries'
import {
  ChartRange,
  getChartRangeParams,
  getPreviousParams,
} from '@/utils/metrics'
import { ArrowOutwardOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface HeroChartProps {
  organization: schemas['Organization']
}

const HeroChart = ({ organization }: HeroChartProps) => {
  const [selectedMetric, setSelectedMetric] =
    React.useState<keyof schemas['Metrics']>('revenue')
  const [selectedRange, setSelectedRange] = React.useState<ChartRange>('30d')
  const [startDate, endDate, interval] = React.useMemo(
    () => getChartRangeParams(selectedRange, organization.created_at),
    [selectedRange, organization.created_at],
  )

  const {
    data: currentPeriodMetricsData,
    isLoading: currentPeriodMetricsLoading,
  } = useMetrics({
    organization_id: organization.id,
    startDate: startDate,
    endDate: endDate,
    interval: interval,
  })

  const previousParams = React.useMemo(
    () => getPreviousParams(startDate, selectedRange),
    [startDate, selectedRange],
  )

  const {
    data: previousPeriodMetricsData,
    isLoading: previousPeriodMetricsLoading,
  } = useMetrics(
    {
      organization_id: organization.id,
      startDate: previousParams ? previousParams[0] : startDate,
      endDate: previousParams ? previousParams[1] : endDate,
      interval: interval,
    },
    previousParams !== null,
  )

  const metricLoading =
    currentPeriodMetricsLoading || previousPeriodMetricsLoading

  return (
    <MetricChartBox
      metric={selectedMetric}
      onMetricChange={setSelectedMetric}
      data={currentPeriodMetricsData}
      previousData={previousPeriodMetricsData}
      interval={interval}
      range={selectedRange}
      onRangeChange={setSelectedRange}
      loading={metricLoading}
    />
  )
}

interface OverviewPageProps {
  organization: schemas['Organization']
  startDate: Date
  endDate: Date
}

export default function OverviewPage({ organization }: OverviewPageProps) {
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
      <div className="dark:bg-polar-900 dark:border-polar-800 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm md:hidden">
        <LogoIcon size={24} />
        <span>Polar for iOS is now available on TestFlight!</span>
        <Link
          href="https://testflight.apple.com/join/CwVdc1Jt"
          target="_blank"
          className="dark:bg-polar-800 dark:hover:bg-polar-700 self-start rounded-sm bg-gray-100 p-1 text-xs transition-colors hover:bg-gray-200"
        >
          <span>Join Beta</span>
          <ArrowOutwardOutlined className="ml-2" fontSize="inherit" />
        </Link>
      </div>
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
        <motion.div
          className={twMerge(cardClassName, 'xl:col-span-2')}
          {...motionVariants}
        >
          <CheckoutsWidget />
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
