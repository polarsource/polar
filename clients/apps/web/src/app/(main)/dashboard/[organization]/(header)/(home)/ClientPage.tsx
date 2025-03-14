'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import OrganizationAccessTokensSettings from '@/components/Settings/OrganizationAccessTokensSettings'
import Spinner from '@/components/Shared/Spinner'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { AccountWidget } from '@/components/Widgets/AccountWidget'
import { ActivityWidget } from '@/components/Widgets/ActivityWidget'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import { RevenueWidget } from '@/components/Widgets/RevenueWidget'
import { SubscribersWidget } from '@/components/Widgets/SubscribersWidget'
import { useMetrics, useProducts } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { computeCumulativeValue, metricDisplayNames } from '@/utils/metrics'
import { ChevronRight } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import {
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from '@polar-sh/ui/components/ui/chart'
import {
  formatCurrencyAndAmount,
  getCentsInDollarString,
} from '@polar-sh/ui/lib/money'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import React, { useContext, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface HeroChartProps {
  organization: schemas['Organization']
}

const intervalDisplayNames: Record<schemas['TimeInterval'], string> = {
  year: '3y',
  month: '12m',
  week: '3m',
  day: '30d',
  hour: '24h',
}

const getIntervalStartDate = (
  interval: schemas['TimeInterval'],
  organization: schemas['Organization'],
) => {
  switch (interval) {
    case 'year':
      const createdAt = new Date(organization.created_at)
      const threeYearsAgo = new Date()
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
      return createdAt < threeYearsAgo ? createdAt : threeYearsAgo
    case 'month':
      return new Date(new Date().setFullYear(new Date().getFullYear() - 1))
    case 'week':
      return new Date(new Date().setMonth(new Date().getMonth() - 3))
    case 'day':
      return new Date(new Date().setDate(new Date().getDate() - 30))
    case 'hour':
      return new Date(new Date().setHours(new Date().getHours() - 12))
  }
}

const getPreviousPeriod = (
  startDate: Date,
  interval: schemas['TimeInterval'],
) => {
  switch (interval) {
    case 'year':
      return new Date(startDate.setFullYear(startDate.getFullYear() - 3))
    case 'month':
      return new Date(startDate.setFullYear(startDate.getFullYear() - 1))
    case 'week':
      return new Date(startDate.setMonth(startDate.getMonth() - 3))
    case 'day':
      return new Date(startDate.setDate(startDate.getDate() - 30))
    case 'hour':
      return new Date(startDate.setHours(startDate.getHours() - 12))
  }
}

const HeroChart = ({ organization }: HeroChartProps) => {
  const [selectedMetric, setSelectedMetric] =
    React.useState<keyof schemas['Metrics']>('revenue')
  const [selectedInterval, setSelectedInterval] =
    React.useState<schemas['TimeInterval']>('day')

  const {
    data: currentPeriodMetricsData,
    isLoading: currentPeriodMetricsLoading,
  } = useMetrics({
    organization_id: organization.id,
    startDate: getIntervalStartDate(selectedInterval, organization),
    endDate: new Date(),
    interval: selectedInterval,
  })

  const previousPeriod = getPreviousPeriod(
    getIntervalStartDate(selectedInterval, organization),
    selectedInterval,
  )

  const {
    data: previousPeriodMetricsData,
    isLoading: previousPeriodMetricsLoading,
  } = useMetrics({
    organization_id: organization.id,
    startDate: previousPeriod,
    endDate: getIntervalStartDate(selectedInterval, organization),
    interval: selectedInterval,
  })

  const mergedData = useMemo(() => {
    if (!currentPeriodMetricsData || !previousPeriodMetricsData) return []

    const metric = selectedMetric

    return currentPeriodMetricsData.periods.map((period, i) => ({
      timestamp: period.timestamp,
      current: period[metric],
      previous: previousPeriodMetricsData.periods[i]?.[metric] ?? 0,
    }))
  }, [currentPeriodMetricsData, previousPeriodMetricsData, selectedMetric])

  const metricValue = useMemo(() => {
    if (!currentPeriodMetricsData) return 0

    const metric = currentPeriodMetricsData.metrics[selectedMetric]
    const value = computeCumulativeValue(
      metric,
      currentPeriodMetricsData.periods.map((period) => period[selectedMetric]),
    )

    if (metric?.type === 'currency') {
      return `$${getCentsInDollarString(value ?? 0)}`
    } else {
      return value
    }
  }, [currentPeriodMetricsData, selectedMetric])

  const { resolvedTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'

  const metricLoading =
    currentPeriodMetricsLoading || previousPeriodMetricsLoading

  return (
    <ShadowBox className="dark:bg-polar-800 flex flex-col bg-gray-100 p-2 shadow-sm">
      <div className="flex flex-row justify-between p-6">
        <div className="flex flex-col gap-3">
          <Select
            value={selectedMetric}
            onValueChange={(value) =>
              setSelectedMetric(value as keyof schemas['Metrics'])
            }
          >
            <SelectTrigger className="h-fit w-fit border-0 border-none bg-transparent p-0 shadow-none ring-0 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 dark:hover:bg-transparent">
              <SelectValue placeholder="Select a metric" />
            </SelectTrigger>
            <SelectContent className="dark:bg-polar-800 dark:ring-polar-700 ring-1 ring-gray-200">
              {Object.entries(metricDisplayNames).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <h2 className="text-3xl">{metricValue}</h2>
          <div className="flex flex-row items-center gap-x-6">
            <div className="flex flex-row items-center gap-x-2">
              <span className="h-3 w-3 rounded-full border-2 border-blue-500" />
              <span className="dark:text-polar-500 text-sm text-gray-500">
                Current Period
              </span>
            </div>
            <div className="flex flex-row items-center gap-x-2">
              <span className="dark:border-polar-600 h-3 w-3 rounded-full border-2 border-gray-500" />
              <span className="dark:text-polar-500 text-sm text-gray-500">
                Previous Period
              </span>
            </div>
          </div>
        </div>
        <Tabs
          value={selectedInterval}
          onValueChange={(value) =>
            setSelectedInterval(value as schemas['TimeInterval'])
          }
        >
          <TabsList className="dark:bg-polar-900 flex flex-row gap-x-0 rounded-md bg-gray-200">
            {Object.entries(intervalDisplayNames)
              .filter(([key]) => key !== 'year')
              .map(([key, value]) => (
                <TabsTrigger
                  size="small"
                  key={key}
                  value={key}
                  className="!rounded-sm p-1 px-2 text-xs font-normal data-[state=active]:bg-white"
                >
                  {value}
                </TabsTrigger>
              ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="dark:bg-polar-900 flex flex-col gap-y-2 rounded-3xl bg-white p-4">
        {metricLoading ? (
          <div className="flex h-[300px] flex-col items-center justify-center">
            <Spinner />
          </div>
        ) : mergedData.length > 0 ? (
          <ChartContainer
            className="h-[300px]"
            config={{
              current: {
                label: 'Current',
                color: '#2563eb',
              },
              previous: {
                label: 'Previous',
                color: isDark ? '#383942' : '#ccc',
              },
              metric: {
                label: metricDisplayNames[selectedMetric],
              },
            }}
          >
            <LineChart
              accessibilityLayer
              data={mergedData}
              margin={{
                left: 0,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => {
                  switch (selectedInterval) {
                    case 'hour':
                      return value.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })
                    case 'day':
                    case 'week':
                      return value.toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                      })
                    case 'month':
                      return value.toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: '2-digit',
                      })
                    case 'year':
                      return value.toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })
                    default:
                      return value.toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                      })
                  }
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => {
                  const metric =
                    currentPeriodMetricsData?.metrics[selectedMetric]

                  if (metric?.type === 'currency') {
                    return formatCurrencyAndAmount(value, 'USD', 0, 'compact')
                  } else {
                    return Intl.NumberFormat('en-US', {
                      notation: 'compact',
                      maximumFractionDigits: 2,
                    }).format(value)
                  }
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    className="text-black dark:text-white"
                    indicator="dot"
                    labelKey="metric"
                    formatter={(value, name) => {
                      const metric =
                        currentPeriodMetricsData?.metrics[selectedMetric]

                      const formattedValue =
                        metric?.type === 'currency'
                          ? formatCurrencyAndAmount(
                              value as number,
                              'USD',
                              0,
                              'compact',
                            )
                          : Intl.NumberFormat('en-US', {
                              notation: 'compact',
                              maximumFractionDigits: 2,
                            }).format(value as number)

                      return (
                        <div className="flex w-full flex-row justify-between">
                          <div className="flex flex-row items-center gap-x-2">
                            <span
                              className={twMerge(
                                'h-2 w-2 rounded-full',
                                name === 'current'
                                  ? 'bg-primary dark:bg-primary'
                                  : 'dark:bg-polar-500 bg-gray-500',
                              )}
                            />
                            <span className="dark:text-polar-500 capitalize text-gray-500">
                              {name}
                            </span>
                          </div>
                          <span>{formattedValue}</span>
                        </div>
                      )
                    }}
                  />
                }
              />
              <Line
                dataKey="previous"
                stroke="var(--color-previous)"
                type="linear"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                dataKey="current"
                stroke="var(--color-current)"
                type="linear"
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[300px] flex-col items-center justify-center">
            <span className="text-lg">No data available</span>
          </div>
        )}
      </div>
    </ShadowBox>
  )
}

interface OverviewPageProps {
  organization: schemas['Organization']
  startDate: Date
  endDate: Date
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  const { data: products } = useProducts(organization.id)

  const motionVariants = {
    variants: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.3 } },
      exit: { opacity: 0, transition: { duration: 0.3 } },
    },
  }
  const cardClassName = 'flex w-full flex-col'

  return (
    <DashboardBody className="gap-y-16 pb-16">
      <HeroChart organization={organization} />
      <motion.div
        className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-10"
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ staggerChildren: 0.1 }}
      >
        <motion.div
          className={twMerge(cardClassName, 'col-span-2')}
          {...motionVariants}
        >
          <ActivityWidget />
        </motion.div>
        <motion.div className={cardClassName} {...motionVariants}>
          <OrdersWidget />
        </motion.div>
        <motion.div className={cardClassName} {...motionVariants}>
          <RevenueWidget />
        </motion.div>
        <motion.div className={cardClassName} {...motionVariants}>
          <SubscribersWidget />
        </motion.div>
        <motion.div className={cardClassName} {...motionVariants}>
          <AccountWidget />
        </motion.div>
      </motion.div>

      {!organization.profile_settings?.enabled &&
        (products?.items.length ?? 0) > 0 && <IntegrationView />}
    </DashboardBody>
  )
}

const IntegrationView = () => {
  const { organization } = useContext(MaintainerOrganizationContext)
  const [selectedProduct, setSelectedProduct] = React.useState<string>()

  const { data: products } = useProducts(organization.id)

  return (
    <ShadowBox className="dark:bg-polar-800 flex w-full flex-col gap-y-16 p-12">
      <div className="flex flex-col gap-y-2">
        <h3 className="text-3xl font-medium">Integrate Polar using the API</h3>
        <p className="dark:text-polar-400 text-lg text-gray-500">
          Sell your products using the Polar API
        </p>
      </div>

      <div className="flex flex-col gap-y-6">
        <h4 className="text-xl font-medium">Install the SDK</h4>
        <pre className="dark:border-polar-700 dark:bg-polar-900 rounded-xl border border-transparent bg-white px-5 py-3 text-sm shadow-sm">
          pnpm install @polar-sh/sdk
        </pre>
      </div>

      <div className="flex flex-col gap-y-6">
        <div className="flex flex-col gap-y-2">
          <h4 className="text-xl font-medium">Create an access token</h4>
          <p className="dark:text-polar-400 text-lg text-gray-500">
            Store it securely in an .env file and use it to authenticate with
            the Polar API
          </p>
        </div>
        <OrganizationAccessTokensSettings organization={organization} />
      </div>

      <div className="flex flex-col gap-y-6">
        <div className="flex flex-col gap-y-2">
          <h4 className="text-xl font-medium">Generate a Checkout URL</h4>
          <p className="dark:text-polar-400 text-lg text-gray-500">
            Start selling your products using the Polar Checkout
          </p>
        </div>
        <div className="flex flex-col gap-y-2">
          <span className="text-sm font-medium">Product</span>
          <Select onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-full max-w-96 capitalize">
              {selectedProduct
                ? products?.items.find(
                    (product) => product.id === selectedProduct,
                  )?.name
                : 'Select Product'}
            </SelectTrigger>
            <SelectContent>
              {products?.items.map((product) => (
                <SelectItem
                  key={product.id}
                  className="flex flex-row items-center gap-x-4"
                  value={product.id}
                >
                  <span className="capitalize">{product.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col">
          <pre className="dark:border-polar-700 dark:bg-polar-900 rounded-3xl border border-transparent bg-white p-8 text-sm shadow-sm">
            <SyntaxHighlighterProvider>
              <SyntaxHighlighterClient
                lang="javascript"
                code={`import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env["POLAR_ACCESS_TOKEN"] ?? "",
});

const checkout = await polar.checkouts.create({
  productId: "${selectedProduct ?? '<PRODUCT_ID>'}",
});

redirect(checkout.url)
`}
              />
            </SyntaxHighlighterProvider>
          </pre>
        </div>
      </div>
      <div className="flex flex-row items-center gap-x-2">
        <Link
          href={`https://docs.polar.sh/documentation/integration-guides/nextjs`}
          target="_blank"
        >
          <Button wrapperClassNames="flex flex-row items-center gap-x-2">
            <span>Checkout API Guide</span>
            <ChevronRight className="text-sm" fontSize="inherit" />
          </Button>
        </Link>
        <Link href={`https://docs.polar.sh/api-reference`} target="_blank">
          <Button
            wrapperClassNames="flex flex-row items-center gap-x-2"
            variant="secondary"
          >
            API Documentation
          </Button>
        </Link>
      </div>
    </ShadowBox>
  )
}
