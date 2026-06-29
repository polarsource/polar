import React from 'react'
import { BrandContainer, Caption, Display, Lead } from '../Brand/primitives'
import { stats } from './data'

export function PricingHero() {
  return (
    <section className="flex min-h-[calc(100vh-164px)] flex-col justify-between gap-y-16 bg-brand-raised pt-20 pb-16 md:gap-y-48 md:pt-32 md:pb-24">
      <BrandContainer className="flex grow flex-col justify-end gap-10">
        <Caption>The pricing directory</Caption>
        <Display className="max-w-[18ch]">Pricing, in the open</Display>
        <Lead className="max-w-2xl">
          A living database of how companies price, and how those prices move
          over time. Study the market, pressure-test your model, and find a
          scheme that fits.
        </Lead>
      </BrandContainer>
      <BrandContainer>
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 border-t border-brand-muted pt-12 md:grid-cols-4 md:pt-16">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-3">
              <span className="text-brand-foreground text-4xl tracking-tight md:text-6xl">
                {stat.value}
              </span>
              <Caption>{stat.label}</Caption>
            </div>
          ))}
        </div>
      </BrandContainer>
    </section>
  )
}
