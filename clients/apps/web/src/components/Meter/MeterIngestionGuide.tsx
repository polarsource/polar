'use client'

import { Well, WellContent, WellHeader } from '@/components/Shared/Well'
import { useIsManagedAsCode } from '@/hooks/permissions'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Lock } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { PropsWithChildren, useContext } from 'react'

const Command = ({ children }: PropsWithChildren) => (
  <Text as="code" variant="caption" color="inherit" monospace wrap="nowrap">
    {children}
  </Text>
)

export const MeterIngestionGuide = () => {
  const { organization } = useContext(OrganizationContext)
  const managedAsCode = useIsManagedAsCode(organization.id)

  return (
    <SyntaxHighlighterProvider>
      <div className="flex h-full flex-col items-center justify-center gap-6 py-12">
        <Well className="flex max-w-full flex-col gap-12 rounded-4xl p-4 md:flex-row">
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
              {managedAsCode ? (
                <Box
                  columnGap="m"
                  alignItems="start"
                  paddingTop="l"
                  borderTopWidth={1}
                  borderStyle="solid"
                  borderColor="border-primary"
                >
                  <Box paddingTop="xs" color="text-tertiary">
                    <Lock size={14} aria-hidden />
                  </Box>
                  <Box flexDirection="column" rowGap="xs">
                    <Text variant="title">Managed in code</Text>
                    <Text variant="caption" color="muted" wrap="pretty">
                      Add meters in <Command>polar.config.ts</Command>, then run{' '}
                      <Command>polar config apply</Command>.
                    </Text>
                  </Box>
                </Box>
              ) : (
                <Link
                  href={`/dashboard/${organization.slug}/products/meters/create`}
                >
                  <Button>Create Meter</Button>
                </Link>
              )}
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
