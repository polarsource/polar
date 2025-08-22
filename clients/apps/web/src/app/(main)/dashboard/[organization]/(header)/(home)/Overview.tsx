'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import PaymentOnboardingStepper from '@/components/Onboarding/PaymentOnboardingStepper'
import { AccountWidget } from '@/components/Widgets/AccountWidget'
import CheckoutsWidget from '@/components/Widgets/CheckoutsWidget'
import { MonthWidget } from '@/components/Widgets/MonthWidget'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import RevenueWidget from '@/components/Widgets/RevenueWidget'
import { SubscribersWidget } from '@/components/Widgets/SubscribersWidget'
import {
  useCustomers,
  useMetrics,
  useOrganizationPaymentStatus,
} from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import {
  getChartRangeParams,
  getFormattedMetricValue,
  getPreviousParams,
} from '@/utils/metrics'
import { ArrowOutwardOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  ChartContainer,
  ChartTooltip,
  Line,
  LineChart,
} from '@polar-sh/ui/components/ui/chart'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { motion } from 'framer-motion'
import Link from 'next/link'
import React, { forwardRef, useContext, useMemo } from 'react'
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
    () => getPreviousParams(startDate, '30d'),
    [startDate],
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
      loading={metricLoading}
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

  const { data: customers } = useCustomers(organization.id, {
    limit: 20,
  })

  return (
    <div className="flex flex-col gap-y-8 pb-16 md:gap-y-12">
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

      <div className="flex flex-col gap-6">
        <h2 className="text-2xl">Top Customers</h2>
        <div className="grid grid-cols-1 gap-6 md:gap-10 xl:grid-cols-3">
          {customers?.pages
            .flatMap((page) => [...page.items, ...page.items, ...page.items])
            .map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
        </div>
      </div>
    </div>
  )
}

const CustomerCard = ({ customer }: { customer: schemas['Customer'] }) => {
  const { organization } = useContext(OrganizationContext)
  const revenue = useMemo(() => Math.random() * 10000, [])
  const cost = useMemo(() => Math.random() * 1000, [])
  const profit = useMemo(() => revenue - cost, [revenue, cost])

  const revenueData = useMemo(
    () =>
      Array.from({ length: 31 }, (_, i) => ({
        timestamp: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
        value: Math.floor(Math.random() * 500 * Math.exp(i / 10)), // Starts at 100, grows by 20% each day
      })),
    [customer],
  )

  const costData = useMemo(
    () =>
      Array.from({ length: 31 }, (_, i) => ({
        timestamp: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
        value: Math.floor(
          Math.random() * 500 * Math.exp(Math.sin(i) + 1) * (i / 20),
        ),
      })),
    [customer],
  )

  const DataPoint = ({
    label,
    value,
  }: {
    label: string
    value: string | number
  }) => {
    return (
      <div className="flex flex-col text-sm">
        <span className="dark:text-polar-500 text-gray-500">{label}</span>
        <span className="text-sm">{value}</span>
      </div>
    )
  }

  return (
    <Link
      href={`/dashboard/${organization.slug}?customerId=${customer.id}&query=${customer.email}`}
      className="dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-700 flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6 transition-colors duration-200 hover:bg-gray-50"
    >
      <div className="flex items-center gap-4 text-sm">
        <Avatar
          avatar_url={customer.avatar_url}
          name={customer.name || customer.email}
          className="h-10 w-10"
        />
        <div className="flex flex-col">
          <h3>{customer.name ?? '—'}</h3>
          <p className="dark:text-polar-500 text-gray-500">{customer.email}</p>
        </div>
      </div>
      <div className="dark:border-polar-700 flex flex-col gap-2 rounded-lg border border-gray-200">
        <UnitGraphMini
          revenueData={revenueData}
          costData={costData}
          interval="day"
          height={100}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <DataPoint
          label="Profit"
          value={formatCurrencyAndAmount(profit, 'USD')}
        />
        <DataPoint
          label="Revenue"
          value={formatCurrencyAndAmount(revenue, 'USD')}
        />
        <DataPoint label="Cost" value={formatCurrencyAndAmount(cost, 'USD')} />
        <DataPoint label="Orders" value={Math.floor(Math.random() * 100)} />
        <DataPoint
          label="Subscriptions"
          value={Math.floor(Math.random() * 10)}
        />
        <DataPoint label="Events" value={Math.floor(Math.random() * 1000)} />
      </div>
    </Link>
  )
}

interface UnitGraphMiniProps {
  ref: React.RefObject<HTMLDivElement>
  revenueData: { timestamp: Date; value: number }[]
  costData: { timestamp: Date; value: number }[]
  interval: schemas['TimeInterval']
  height?: number
  width?: number
  grid?: boolean
  onDataIndexHover?: (index: number | undefined) => void
  simple?: boolean
}

const UnitGraphMini = forwardRef<HTMLDivElement, UnitGraphMiniProps>(
  (
    {
      revenueData,
      costData,
      interval,
      height: _height,
      width: _width,
      onDataIndexHover,
    },
    ref,
  ) => {
    return (
      <ChartContainer
        ref={ref}
        style={{ height: _height, width: _width }}
        config={{
          revenue: {
            label: 'Revenue',
            color: '#10b981',
          },
          cost: {
            label: 'Cost',
            color: '#ef4444',
          },
          profit: {
            label: 'Profit',
            color: '#6366f1',
          },
          metric: {
            label: 'Revenue vs. Cost',
          },
        }}
      >
        <LineChart
          accessibilityLayer
          data={revenueData.map((period, index) => ({
            ...period,
            revenue: period.value,
            cost: costData[index]?.value ?? 0,
            profit: period.value - (costData[index]?.value ?? 0),
          }))}
          onMouseMove={(state) => {
            if (onDataIndexHover) {
              onDataIndexHover(state.activeTooltipIndex)
            }
          }}
          onMouseLeave={() => {
            if (onDataIndexHover) {
              onDataIndexHover(undefined)
            }
          }}
        >
          <ChartTooltip
            includeHidden
            content={({ payload }) => (
              <div className="dark:bg-polar-900 flex w-48 flex-col gap-y-2 rounded-md bg-white p-2 text-black shadow-xl dark:text-white">
                <span>Revenue vs. Cost</span>
                <div className="flex flex-col">
                  {payload?.map((item, index, array) => (
                    <div
                      key={item.name}
                      className={twMerge(
                        'flex w-full flex-row justify-between gap-x-2',
                        index === array.length - 1 &&
                          'dark:border-polar-600 mt-2 border-t border-gray-200 pt-2',
                      )}
                    >
                      <div className="flex flex-row items-center gap-x-2">
                        <span
                          className={twMerge(
                            'h-2 w-2 rounded-full',
                            index === array.length - 1 && 'hidden',
                          )}
                          style={{
                            backgroundColor: item?.color,
                          }}
                        />
                        <span className="capitalize">
                          {item.name?.toString().split('_').join(' ')}
                        </span>
                      </div>
                      <span className="">
                        {getFormattedMetricValue(
                          {
                            slug: 'revenue_vs_cost',
                            display_name: 'Revenue vs. Cost',
                            type: 'currency',
                          },
                          item.value as number,
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          />
          <Line
            dataKey="cost"
            stroke="var(--color-cost)"
            type="linear"
            dot={false}
            strokeWidth={1.5}
          />
          <Line
            dataKey="revenue"
            stroke="var(--color-revenue)"
            type="linear"
            dot={false}
            strokeWidth={1.5}
          />
          <Line dataKey="profit" hide />
        </LineChart>
      </ChartContainer>
    )
  },
)
