'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MetricChart from '@/components/Metrics/MetricChart'
import AccessTokensSettings from '@/components/Settings/AccessTokensSettings'
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
import { defaultMetricMarks } from '@/utils/metrics'
import { ChevronRight } from '@mui/icons-material'
import { Metric, Metrics, MetricType, Organization } from '@polar-sh/api'
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
import { getCentsInDollarString } from '@polar-sh/ui/lib/money'
import Link from 'next/link'
import React, { useCallback, useContext, useMemo } from 'react'

const metricDisplayNames: Record<keyof Metrics, string> = {
  revenue: 'Revenue',
  orders: 'Orders',
  cumulative_revenue: 'Cumulative Revenue',
  average_order_value: 'Average Order Value',
  one_time_products: 'One-Time Products',
  one_time_products_revenue: 'One-Time Products Revenue',
  new_subscriptions: 'New Subscriptions',
  new_subscriptions_revenue: 'New Subscriptions Revenue',
  renewed_subscriptions: 'Renewed Subscriptions',
  renewed_subscriptions_revenue: 'Renewed Subscriptions Revenue',
  active_subscriptions: 'Active Subscriptions',
  monthly_recurring_revenue: 'Monthly Recurring Revenue',
}

interface HeroChartProps {
  organization: Organization
}

const HeroChart = ({ organization }: HeroChartProps) => {
  const [selectedMetric, setSelectedMetric] =
    React.useState<keyof Metrics>('cumulative_revenue')
  const [hoveredMetricPeriod, setHoveredMetricPeriod] =
    React.useState<ParsedMetricPeriod | null>(null)

  const { data: metricsData, isLoading: metricsLoading } = useMetrics({
    organizationId: organization.id,
    startDate: new Date(new Date().setDate(new Date().getDate() - 31)),
    endDate: new Date(),
    interval: 'day',
  })

  const getMetricValue = useCallback((metric?: Metric, value?: number) => {
    if (metric?.type === MetricType.CURRENCY) {
      return `$${getCentsInDollarString(value ?? 0)}`
    } else {
      return value
    }
  }, [])

  const currentMetricPeriod = useMemo(() => {
    return metricsData?.periods[metricsData.periods.length - 1]
  }, [metricsData])

  if (metricsLoading) return null

  return (
    <ShadowBox className="dark:bg-polar-800 flex flex-col bg-gray-50 p-2 shadow-sm">
      <div className="flex flex-row justify-between p-6">
        <div className="flex flex-col gap-3">
          <Select
            value={selectedMetric}
            onValueChange={(value) => setSelectedMetric(value as keyof Metrics)}
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
          <h2 className="text-3xl">
            {getMetricValue(
              metricsData?.metrics[selectedMetric],
              currentMetricPeriod?.[selectedMetric],
            )}
          </h2>
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
                  />
                  {' — '}
                  {getMetricValue(
                    metricsData?.metrics[selectedMetric],
                    hoveredMetricPeriod[selectedMetric],
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
        <Link href={`/dashboard/${organization.slug}/analytics`}>
          <Button>View Analytics</Button>
        </Link>
      </div>
      <div className="dark:bg-polar-900 flex flex-col gap-y-2 rounded-3xl bg-white p-4">
        {metricsData && (
          <MetricChart
            height={350}
            data={metricsData.periods}
            interval="day"
            marks={defaultMetricMarks}
            metric={metricsData.metrics[selectedMetric]}
            onDataIndexHover={(period) =>
              setHoveredMetricPeriod(
                metricsData.periods[period as number] ?? null,
              )
            }
          />
        )}
      </div>
    </ShadowBox>
  )
}

interface OverviewPageProps {
  organization: Organization
  startDate: Date
  endDate: Date
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  const { data: products } = useProducts(organization.id)

  return (
    <DashboardBody className="gap-y-16 pb-16">
      <HeroChart organization={organization} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-10">
        <ActivityWidget className="col-span-2" />
        <OrdersWidget />
        <RevenueWidget />
        <SubscribersWidget />
        <AccountWidget />
      </div>

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
        <AccessTokensSettings />
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

const checkout = await polar.checkouts.custom.create({
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
            variant="ghost"
          >
            API Documentation
          </Button>
        </Link>
      </div>
    </ShadowBox>
  )
}
