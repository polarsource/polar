import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { Well } from '../Shared/Well'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'

export const EventCostCreationGuideModal = () => {
  return (
    <SyntaxHighlighterProvider>
      <div className="flex flex-col gap-8 p-6">
        <div className="flex flex-col gap-y-4">
          <h1 className="text-2xl">Event Cost Ingestion</h1>
          <p className="dark:text-polar-500 text-gray-500">
            Associate costs with events by adding a{' '}
            <code className="font-mono text-sm">_cost</code> property to your
            event metadata.
          </p>
        </div>
        <Well className="dark:bg-polar-800 rounded-lg bg-gray-100 p-4 text-sm">
          <SyntaxHighlighterClient
            lang="typescript"
            code={`import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env["POLAR_ACCESS_TOKEN"] ?? "",
});

const result = await polar.events.ingest({
  events: [
    {
      name: "<value>",
      customerId: "<value>",
      metadata: {
        myCustomProperty: "value",
        _cost: {
          amount: 100, // $1.00
          currency: "usd",
        },
      },
    },
  ],
});`}
          />
        </Well>
        <div className="flex flex-row items-center gap-x-4">
          <Link
            href="https://docs.polar.sh/features/cost-insights/cost-events"
            target="_blank"
            className="flex flex-row items-center"
          >
            <Button variant="secondary">
              <span>Learn more</span>
              <ArrowOutwardOutlined fontSize="inherit" className="ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </SyntaxHighlighterProvider>
  )
}
