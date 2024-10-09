'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ProductWizard } from '@/components/Products/ProductWizard/ProductWizard'
import { StorefrontHeader } from '@/components/Profile/StorefrontHeader'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { ChevronRight } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import React, { useContext } from 'react'

const OnboardingPage: React.FC = ({}) => {
  const { organization } = useContext(MaintainerOrganizationContext)

  return (
    <DashboardBody
      header={false}
      className="flex flex-col gap-y-8 pb-24 md:gap-y-20"
    >
      <div className="flex flex-col gap-y-16 py-16">
        <div className="flex flex-col gap-y-4">
          <h3 className="text-3xl font-medium">Welcome to Polar!</h3>
          <p className="dark:text-polar-400 text-gray-500">
            Let&apos;s get up to speed by setting up your storefront or
            integrating with our API
          </p>
        </div>

        <div className="flex w-full flex-col gap-y-8">
          <ProductWizard organization={organization} />
        </div>

        <Tabs
          className="flex w-full flex-col items-center gap-y-8"
          defaultValue="storefront"
        >
          <TabsList className="dark:bg-polar-950 w-full max-w-96 rounded-full bg-gray-200">
            <TabsTrigger className="w-1/2" value="storefront">
              Storefront
            </TabsTrigger>
            <TabsTrigger className="w-1/2" value="api">
              Integrate with API
            </TabsTrigger>
          </TabsList>
          <TabsContent className="w-full" value="storefront">
            <ShadowBox className="flex w-full flex-row items-center gap-x-8 p-12">
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
          </TabsContent>
          <TabsContent className="w-full" value="api">
            <ShadowBox className="flex w-full flex-row items-center gap-x-8 p-12">
              <div className="flex w-1/2 flex-col gap-y-6">
                <h3 className="text-3xl font-medium">
                  Build with the Polar API
                </h3>
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
            </ShadowBox>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardBody>
  )
}

export default OnboardingPage
