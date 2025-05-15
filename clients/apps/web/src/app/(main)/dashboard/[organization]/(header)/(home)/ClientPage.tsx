'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import OrganizationAccessTokensSettings from '@/components/Settings/OrganizationAccessTokensSettings'
import { Well, WellContent, WellHeader } from '@/components/Shared/Well'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { AccountWidget } from '@/components/Widgets/AccountWidget'
import { ActivityWidget } from '@/components/Widgets/ActivityWidget'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import { RevenueWidget } from '@/components/Widgets/RevenueWidget'
import { SubscribersWidget } from '@/components/Widgets/SubscribersWidget'
import { useMetrics, useProducts, useUpdateOrganization } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import {
  ChartRange,
  getChartRangeParams,
  getPreviousParams,
} from '@/utils/metrics'
import { ChevronRight, DonutLargeOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { motion } from 'framer-motion'
import Link from 'next/link'
import React, { useContext } from 'react'
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
      <UsageBasedBillingBanner />
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

      {(products?.items.length ?? 0) > 0 && (
        <IntegrationView organization={organization} />
      )}
    </DashboardBody>
  )
}

const IntegrationView = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [selectedProduct, setSelectedProduct] = React.useState<string>()

  const { data: products } = useProducts(organization.id)

  return (
    <ShadowBox className="flex w-full flex-col gap-y-16 border-gray-200 bg-transparent p-12 dark:bg-transparent">
      <div className="flex flex-col gap-y-2">
        <h3 className="text-3xl font-medium">Integrate Polar using the API</h3>
        <p className="dark:text-polar-400 text-lg text-gray-500">
          Sell your products using the Polar API
        </p>
      </div>

      <div className="flex flex-col gap-y-6">
        <h4 className="text-xl font-medium">Install the SDK</h4>
        <pre className="dark:border-polar-700 dark:bg-polar-800 rounded-xl border border-transparent bg-gray-100 px-5 py-3 text-sm shadow-sm">
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
          <pre className="dark:border-polar-700 dark:bg-polar-900 rounded-2xl border border-gray-200 p-6 text-sm shadow-sm">
            <SyntaxHighlighterProvider>
              <SyntaxHighlighterClient
                lang="javascript"
                code={`import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env["POLAR_ACCESS_TOKEN"] ?? "",
});

const checkout = await polar.checkouts.create({
  products: ["${selectedProduct ?? '<PRODUCT_ID>'}"],
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

const UsageBasedBillingBanner = () => {
  const { organization } = useContext(OrganizationContext)

  const updateOrganization = useUpdateOrganization()

  const handleEnableUsageBasedBilling = async () => {
    await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        feature_settings: {
          usage_based_billing_enabled: true,
          issue_funding_enabled:
            organization.feature_settings?.issue_funding_enabled ?? false,
        },
      },
    })
  }

  return (
    <Well className="shadow-3xl flex flex-row items-center justify-between gap-x-6 bg-white p-6">
      <div className="flex flex-col gap-y-2">
        <WellHeader className="flex flex-row items-center gap-x-2">
          <DonutLargeOutlined fontSize="small" className="text-blue-500" />
          <h3 className="text-lg font-medium">
            Introducing Usage Based Billing
          </h3>
        </WellHeader>
        <WellContent>
          <p className="dark:text-polar-500 text-gray-500">
            Unlock new revenue streams based on the usage of your application.
            Now in Alpha.
          </p>
        </WellContent>
      </div>
      <div className="flex flex-row items-center gap-x-4">
        <Link
          href="https://docs.polar.sh/features/usage-based-billing/introduction"
          target="_blank"
        >
          <Button
            variant={
              organization.feature_settings?.usage_based_billing_enabled
                ? 'default'
                : 'secondary'
            }
          >
            Learn More
          </Button>
        </Link>
        {!organization.feature_settings?.usage_based_billing_enabled && (
          <Button
            loading={updateOrganization.isPending}
            onClick={handleEnableUsageBasedBilling}
          >
            Enable
          </Button>
        )}
      </div>
    </Well>
  )
}
