import { components } from '@polar-sh/client'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'

export interface MeterGetStartedProps {
  meter: components['schemas']['Meter']
}

export const MeterGetStarted = ({}: MeterGetStartedProps) => {
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
          <SyntaxHighlighterClient lang="typescript" code={`TBD`} />
        </SyntaxHighlighterProvider>
      </pre>
    </div>
  )
}
