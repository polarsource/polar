import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'

import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'

export interface MeterGetStartedProps {
  meter: schemas['Meter']
}

export const MeterGetStarted = ({ meter }: MeterGetStartedProps) => {
  const findNameClause = (
    clauses: schemas['Filter']['clauses'],
  ): schemas['FilterClause'] | null => {
    for (const clause of clauses) {
      if (
        'property' in clause &&
        clause.property === 'name' &&
        clause.operator === 'eq'
      ) {
        return clause
      }

      if ('clauses' in clause) {
        const found = findNameClause(clause.clauses)
        if (found) return found
      }
    }
    return null
  }

  const nameClause = findNameClause(meter.filter.clauses)

  const nameClauseValue = nameClause
    ? (nameClause as { value: string }).value
    : 'some_arbitrary_name'

  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-gray-100 p-6">
      <div className="flex flex-col gap-y-2">
        <h2 className="text-xl">Get started with metering</h2>
        <p className="dark:text-polar-500 text-gray-500">
          Meter usage by sending events which match the Meter Filter, to the
          Polar Ingestion API.
        </p>
      </div>
      <pre className="dark:bg-polar-900 rounded-lg bg-white p-4 font-mono text-sm">
        <SyntaxHighlighterProvider>
          <SyntaxHighlighterClient
            lang="typescript"
            code={`import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env["POLAR_ACCESS_TOKEN"] ?? "",${
    CONFIG.IS_SANDBOX
      ? `
  server: "sandbox",`
      : ''
  }
});

export const GET = async (req: Request, res: Response) => {
  await polar.events.ingest({
    events: [
      {
        name: "${nameClauseValue}",
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
        </SyntaxHighlighterProvider>
      </pre>
    </div>
  )
}
