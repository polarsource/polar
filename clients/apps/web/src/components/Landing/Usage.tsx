'use client'

import { SyntaxHighlighterProvider } from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { Ingestion } from './billing/Ingestion'
import { EventStream } from './EventStream'

export const Usage = () => {
  return (
    <SyntaxHighlighterProvider>
      <div className="flex w-full flex-col gap-y-16">
        <div className="flex flex-col items-center gap-y-8">
          <span className="dark:text-polar-500 text-lg text-gray-400">
            Ingestion Based Billing
          </span>
          <h1 className="w-fit max-w-3xl text-center text-3xl text-pretty md:text-5xl md:leading-normal">
            Usage Based Billing on Autopilot
          </h1>
        </div>
        <div className="flex w-full flex-col gap-12 md:flex-row">
          <Ingestion />
          <EventStream />
        </div>
      </div>
    </SyntaxHighlighterProvider>
  )
}
