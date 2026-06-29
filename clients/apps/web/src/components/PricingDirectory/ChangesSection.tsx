import React from 'react'
import { BrandContainer, Body, Caption, Heading, Lead } from '../Brand/primitives'
import { ChangeDirection, recentChanges } from './data'

const directionLabel: Record<ChangeDirection, string> = {
  up: 'Increase',
  down: 'Decrease',
  new: 'New model',
}

export function ChangesSection() {
  return (
    <section id="changes" className="scroll-mt-24 py-24 md:py-40">
      <BrandContainer className="flex flex-col gap-16 md:gap-24">
        <div className="flex flex-col gap-10 md:gap-14">
          <div className="text-brand-muted flex items-center gap-x-3 text-2xl">
            <span>002</span>
            <span className="bg-brand-muted h-px w-12" />
            <span>Changes</span>
          </div>
          <Heading className="max-w-5xl">How pricing moves</Heading>
          <Lead>
            Pricing is never static. Here is what shifted across the directory
            most recently.
          </Lead>
        </div>

        <div className="flex flex-col">
          {recentChanges.map((change) => (
            <div
              key={`${change.date}-${change.company}`}
              className="border-brand-line grid grid-cols-1 gap-4 border-t py-10 first:border-t-0 first:pt-0 md:grid-cols-12 md:gap-8 md:py-12"
            >
              <Caption className="tabular-nums md:col-span-2">
                {change.date}
              </Caption>
              <div className="flex flex-col gap-4 md:col-span-10">
                <div className="flex items-baseline gap-4">
                  <span className="text-brand-foreground text-2xl tracking-tight md:text-4xl">
                    {change.company}
                  </span>
                  <Caption>{directionLabel[change.direction]}</Caption>
                </div>
                <Body className="max-w-2xl">{change.summary}</Body>
              </div>
            </div>
          ))}
        </div>
      </BrandContainer>
    </section>
  )
}
