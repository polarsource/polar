'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ProductCard } from '@/components/Products/ProductCard'
import { ProductWizard } from '@/components/Products/ProductWizard/ProductWizard'
import AccessTokensSettings from '@/components/Settings/AccessTokensSettings'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
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
import { Organization, Product } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from 'polarkit/components/ui/atoms/select'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import React, { useContext, useEffect, useMemo } from 'react'

interface OverviewPageProps {
  organization: Organization
  startDate: Date
  endDate: Date
}

const OverviewPage: React.FC<OverviewPageProps> = ({ organization }) => {
  const [createdProduct, setCreatedProduct] = React.useState<
    Product | undefined
  >()

  const { onboarding } = useContext(MaintainerOrganizationContext)

  if (onboarding.loading && !createdProduct) {
    return <DashboardBody header={false} />
  }

  return (
    <DashboardBody
      header={onboarding.completed && !createdProduct}
      className="gap-y-16 pb-16"
    >
      <OnboardingView
        organization={organization}
        createdProduct={createdProduct}
        onSuccess={setCreatedProduct}
      />

      {onboarding.completed && !createdProduct && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-10">
          <ActivityWidget className="col-span-2" />
          <OrdersWidget />
          <RevenueWidget />
          <SubscribersWidget />
          <AccountWidget />
        </div>
      )}

      {!organization.profile_settings?.enabled && onboarding.completed && (
        <IntegrationView />
      )}
    </DashboardBody>
  )
}

const IntegrationView = () => {
  const { organization } = useContext(MaintainerOrganizationContext)
  const [selectedPriceId, setSelectedPriceId] = React.useState<string>()

  const { data: products } = useProducts(organization.id)

  const productPrices = useMemo(() => {
    return new Map(
      products?.items.flatMap((product) =>
        product.prices.map((price) => [
          price.id,
          price.type === 'recurring'
            ? `${product.name} (${price.recurring_interval}ly)`
            : product.name,
        ]),
      ),
    )
  }, [products])

  useEffect(() => {
    if (products?.items.length && !selectedPriceId) {
      setSelectedPriceId(products.items[0].prices[0].id)
    }
  }, [products])

  return (
    <ShadowBox className="flex w-full flex-col gap-y-16 p-12">
      <div className="flex flex-col gap-y-2">
        <h3 className="text-3xl font-medium">Integrate Polar using the API</h3>
        <p className="dark:text-polar-400 text-lg text-gray-500">
          Sell your products using the Polar API
        </p>
      </div>

      <div className="flex flex-col gap-y-6">
        <h4 className="text-xl font-medium">Install the SDK</h4>
        <pre className="dark:border-polar-700 dark:bg-polar-950 rounded-3xl border border-transparent bg-white px-8 py-6 text-sm shadow-sm">
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
          <span className="text-sm font-medium">Product Price</span>
          <Select onValueChange={setSelectedPriceId}>
            <SelectTrigger className="w-full max-w-96 capitalize">
              {selectedPriceId
                ? productPrices.get(selectedPriceId)
                : 'Select Product Price'}
            </SelectTrigger>
            <SelectContent>
              {[...productPrices].map(([id, name]) => (
                <SelectItem
                  key={id}
                  className="flex flex-row items-center gap-x-4"
                  value={id}
                >
                  <span className="capitalize">{name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col">
          <pre className="dark:border-polar-700 dark:bg-polar-950 rounded-3xl border border-transparent bg-white p-8 text-sm shadow-sm">
            <SyntaxHighlighterProvider>
              <SyntaxHighlighterClient
                lang="javascript"
                code={`import { Polar } from "@polar-sh/sdk";
import express, { Request, Response } from 'express';

const app = express();
const port = 3000;
const polar = new Polar({
    accessToken: process.env["POLAR_ACCESS_TOKEN"] ?? "",
});

app.get('/checkout', async (req: Request, res: Response) => {
    const checkout = await polar.checkouts.custom.create({
        productPriceId: "${selectedPriceId ?? '<PRODUCT_PRICE_ID>'}",
    });
    res.redirect(checkout.url);
});

app.listen(port, () => {
    console.log(\`Server is running on http://localhost:\${port}\`);
});`}
              />
            </SyntaxHighlighterProvider>
          </pre>
        </div>
      </div>
      <div className="flex flex-row items-center gap-x-2">
        <Link href={`/docs/guides/node`} target="_blank">
          <Button wrapperClassNames="flex flex-row items-center gap-x-2">
            <span>Checkout API Guide</span>
            <ChevronRight className="text-sm" fontSize="inherit" />
          </Button>
        </Link>
        <Link href={`/docs/api`} target="_blank">
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

const OnboardingView = ({
  organization,
  createdProduct,
  onSuccess,
}: {
  organization: Organization
  createdProduct?: Product
  onSuccess?: (product: Product) => void
}) => {
  const { onboarding } = useContext(MaintainerOrganizationContext)

  if (onboarding.completed && !createdProduct) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-16 py-16">
      <div className="flex flex-col gap-y-4">
        <h3 className="text-3xl font-medium">Welcome to Polar!</h3>
        <p className="dark:text-polar-400 text-lg text-gray-500">
          Let&apos;s get up to speed by setting up your first product
        </p>
      </div>

      <div className="flex w-full flex-col gap-y-8">
        <ProductWizard
          organization={organization}
          completed={!!createdProduct}
          onSuccess={onSuccess}
        />
      </div>

      {createdProduct && (
        <ShadowBox className="flex w-full flex-row items-center gap-x-16 p-12">
          <div className="flex w-1/2 flex-col gap-y-6">
            <div className="flex flex-col gap-y-2">
              <h3 className="text-2xl font-medium">
                Your product was successfully created
              </h3>
              <p className="dark:text-polar-400 text-lg text-gray-500">
                Let&apos;s see how this product looks when customers look at it
                in Checkout mode
              </p>
            </div>
            <div className="flex flex-row items-center gap-x-4">
              <Link
                href={`/dashboard/${organization.slug}/storefront?mode=checkout&productId=${createdProduct.id}`}
              >
                <Button>Customize Checkout</Button>
              </Link>
            </div>
          </div>

          <div className="flex w-1/2 flex-col gap-y-6">
            {createdProduct.is_recurring ? (
              <SubscriptionTierCard subscriptionTier={createdProduct} />
            ) : (
              <ProductCard product={createdProduct} />
            )}
          </div>
        </ShadowBox>
      )}

      {/* <ShadowBox className="flex w-full flex-row items-center gap-x-16 p-12">
        <div className="flex w-1/2 flex-col gap-y-6">
          <h3 className="text-3xl font-medium">
            Launch your Storefront on Polar
          </h3>
          <p className="dark:text-polar-400 text-lg text-gray-500">
            Start selling your products on Polar with a hosted storefront
          </p>
          <Link href={`/dashboard/${organization.slug}/storefront`}>
            <Button>Enable Storefront</Button>
          </Link>
        </div>
        <div className="dark:bg-polar-950 rounded-4xl flex w-1/2 flex-col items-center bg-gray-100 p-8">
          <StorefrontHeader organization={organization} />
        </div>
      </ShadowBox>
      <ShadowBox className="flex w-full flex-row items-center gap-x-16 p-12">
        <div className="flex flex-col">
          <pre className="dark:border-polar-700 dark:bg-polar-950 rounded-3xl border border-transparent bg-white p-8 text-sm shadow-sm">
            <SyntaxHighlighterProvider>
              <SyntaxHighlighterClient
                lang="javascript"
                code={`import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env["POLAR_ACCESS_TOKEN"] ?? "",
});

(async () => {
  const result = await polar.products.list({
    organizationId: "${organization.id}",
  });
  
  for await (const page of result) {
    // Handle the page
    console.log(page);
  }
})();`}
              />
            </SyntaxHighlighterProvider>
          </pre>
        </div>
        <div className="flex w-1/2 flex-col gap-y-6">
          <h3 className="text-3xl font-medium">Build with the Polar API</h3>
          <p className="dark:text-polar-400 text-lg text-gray-500">
            Build your own solutions using our SDKs & API
          </p>
          <Link href={`/docs/api`} target="_blank">
            <Button wrapperClassNames="flex flex-row items-center gap-x-2">
              <span>API Documentation</span>
              <ChevronRight className="text-sm" fontSize="inherit" />
            </Button>
          </Link>
        </div>
      </ShadowBox> */}
    </div>
  )
}

export default OverviewPage
