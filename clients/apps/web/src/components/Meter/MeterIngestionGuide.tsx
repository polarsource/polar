'use client'

import { Well, WellContent, WellHeader } from '@/components/Shared/Well'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { useContext } from 'react'

export const MeterIngestionGuide = () => {
  const { organization } = useContext(OrganizationContext)

  return (
    <SyntaxHighlighterProvider>
      <div className="flex h-full flex-col items-center justify-center gap-6 py-12">
        <Well className="flex flex-col gap-12 rounded-4xl p-4 md:flex-row">
          <div className="flex w-full flex-col gap-6 p-6 md:max-w-sm">
            <WellHeader>
              <h2 className="text-2xl">Usage Billing with Meters</h2>
            </WellHeader>
            <WellContent className="flex grow flex-col justify-between gap-6">
              <div className="flex flex-col gap-4">
                <p className="dark:text-polar-300 text-gray-700">
                  Meters are aggregated filters on ingested events. They are
                  used to calculate your customer&apos;s usage of whatever you
                  choose to measure.
                </p>
                <p className="dark:text-polar-300 text-gray-700">
                  For example, if you want to measure the number of API calls
                  your customer makes, you can create a meter that counts the
                  number of events with an arbitrary name like{' '}
                  <code>api_call</code>.
                </p>
              </div>
              <Link
                href={`/dashboard/${organization.slug}/products/meters/create`}
              >
                <Button>Create Meter</Button>
              </Link>
            </WellContent>
          </div>
          <Well className="dark:bg-polar-900 flex-1 shrink overflow-auto bg-white p-6 text-sm">
            <SyntaxHighlighterClient
              lang="typescript"
              code={`import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env["POLAR_ACCESS_TOKEN"] ?? "",
});

export const GET = async (req: Request, res: Response) => {
  await polar.events.ingest({
    events: [
      {
        name: "api_call",
        // Replace with your logic to get the customer id
        externalCustomerId: req.ctx.customerId,
        metadata: {
          route: "/api/metered-route",
          method: "GET",
        },
      },
    ],
  });

  return new Response({ hello: 'world' })
}`}
            />
          </Well>
        </Well>
      </div>
    </SyntaxHighlighterProvider>
  )
}
