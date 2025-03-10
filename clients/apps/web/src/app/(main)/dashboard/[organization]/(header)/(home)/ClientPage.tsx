'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MetricChart from '@/components/Metrics/MetricChart'
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
import { ParsedMetricPeriod, useMetrics, useProducts } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import {
  computeCumulativeValue,
  defaultMetricMarks,
  metricDisplayNames,
} from '@/utils/metrics'
import { ChevronRight } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import { getCentsInDollarString } from '@polar-sh/ui/lib/money'
import { motion } from 'framer-motion'
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
      return new Date(new Date().setHours(new Date().getHours() - 24))
  }
}

const HeroChart = ({ organization }: HeroChartProps) => {
  const [selectedMetric, setSelectedMetric] =
    React.useState<keyof schemas['Metrics']>('revenue')
  const [selectedInterval, setSelectedInterval] =
    React.useState<schemas['TimeInterval']>('day')
  const [hoveredMetricPeriod, setHoveredMetricPeriod] =
    React.useState<ParsedMetricPeriod | null>(null)

  const { data: metricsData, isLoading: metricsLoading } = useMetrics({
    organization_id: organization.id,
    startDate: getIntervalStartDate(selectedInterval, organization),
    endDate: new Date(),
    interval: selectedInterval,
  })

  const metricValue = useMemo(() => {
    if (!metricsData) return 0

    const currentMetricPeriod = hoveredMetricPeriod
      ? hoveredMetricPeriod
      : metricsData.periods[metricsData.periods.length - 1]

    const metric = metricsData.metrics[selectedMetric]
    const value = hoveredMetricPeriod
      ? currentMetricPeriod[selectedMetric]
      : computeCumulativeValue(
          metric,
          metricsData.periods.map((period) => period[selectedMetric]),
        )

    if (metric?.type === 'currency') {
      return `$${getCentsInDollarString(value ?? 0)}`
    } else {
      return value
    }
  }, [hoveredMetricPeriod, metricsData, selectedMetric])

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
            {hoveredMetricPeriod && (
              <div className="flex flex-row items-center gap-x-2">
                <span className="h-3 w-3 rounded-full border-2 border-gray-500 dark:border-gray-700" />
                <span className="dark:text-polar-500 text-sm text-gray-500">
                  <FormattedDateTime
                    datetime={hoveredMetricPeriod.timestamp}
                    dateStyle="medium"
                    resolution={selectedInterval === 'hour' ? 'time' : 'day'}
                  />
                </span>
              </div>
            )}
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
        {metricsLoading ? (
          <div className="flex h-[300px] flex-col items-center justify-center">
            <Spinner />
          </div>
        ) : metricsData ? (
          <MetricChart
            height={300}
            data={metricsData.periods}
            interval={selectedInterval}
            marks={defaultMetricMarks}
            metric={metricsData.metrics[selectedMetric]}
            onDataIndexHover={(period) =>
              setHoveredMetricPeriod(
                metricsData.periods[period as number] ?? null,
              )
            }
          />
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
