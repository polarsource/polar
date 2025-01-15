'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
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
import { useProducts } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { ChevronRight } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from 'polarkit/components/ui/atoms/select'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import React, { useContext } from 'react'

interface OverviewPageProps {
  organization: Organization
  startDate: Date
  endDate: Date
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  const { data: products } = useProducts(organization.id)

  return (
    <DashboardBody className="gap-y-16 pb-16">
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
