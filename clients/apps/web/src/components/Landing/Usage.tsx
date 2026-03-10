'use client'

import { SyntaxHighlighterProvider } from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { CustomerCard } from './billing/CustomerCard'
import { Ingestion } from './billing/Ingestion'
import { EventStream } from './EventStream'

export const Usage = () => {
  return (
    <SyntaxHighlighterProvider>
      <div className="flex w-full flex-col gap-y-16">
        <div className="flex flex-col items-center gap-y-8">
          <span className="dark:text-polar-500 font-mono text-lg text-gray-500">
            billing = fn(events)
          </span>
          <h1 className="w-fit max-w-3xl text-center text-3xl text-pretty md:text-5xl md:leading-normal">
            Usage Billing on Autopilot
          </h1>
        </div>
        <div className="grid w-full grid-cols-1 grid-rows-2 gap-8 xl:grid-cols-2">
          <Ingestion />
          <EventStream />
          <CustomerCard />
        </div>
      </div>
    </SyntaxHighlighterProvider>
  )
}
