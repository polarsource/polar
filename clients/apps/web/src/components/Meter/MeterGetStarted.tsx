import { Meter } from '@/app/api/meters/data'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'

export interface MeterGetStartedProps {
  meter: Meter
}

export const MeterGetStarted = ({ meter }: MeterGetStartedProps) => {
  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-gray-100 p-6">
      <div className="flex flex-col gap-y-2">
        <h2 className="text-xl">Get started with metering</h2>
        <p className="dark:text-polar-500 text-gray-500">
          Meter usage by sending meter events to the Polar API. Use our handy
          NextJS Usage utility if you&apos;re using Next.js.
        </p>
      </div>
      <pre className="dark:bg-polar-900 rounded-lg bg-white p-4 font-mono text-sm">
        <SyntaxHighlighterProvider>
          <SyntaxHighlighterClient
            lang="typescript"
            code={`import { Usage } from "@polar-sh/nextjs";
              
export const POST = Usage()
  .model(openai("gpt-4o-mini"))
  .customer(async (req) => req.headers.get("X-Polar-Customer-Id") ?? "")
  .increment("${meter.slug}", (ctx) => ctx.usage.promptTokens)
  .handler(async (req, res, model) => /** Handle request and model as usual */);
`}
          />
        </SyntaxHighlighterProvider>
      </pre>
    </div>
  )
}
