import Link from 'next/link'
import React from 'react'
import {
  BrandContainer,
  Caption,
  Display,
  Heading,
  Lead,
} from '../Brand/primitives'
import { CompanyDetail as CompanyDetailData } from './companyDetails'
import { ChangeDirection, PricingEntry } from './data'

const directionLabel: Record<ChangeDirection, string> = {
  up: 'Increase',
  down: 'Decrease',
  new: 'New model',
}

export function CompanyDetail({
  entry,
  detail,
}: {
  entry: PricingEntry
  detail: CompanyDetailData
}) {
  const since = detail.history[detail.history.length - 1]?.date.slice(0, 4)

  const facts = [
    { value: entry.model, label: 'Model' },
    { value: entry.anchor, label: 'Current price' },
    { value: `${entry.changes}`, label: 'Changes tracked' },
    { value: since ?? entry.lastChange.slice(0, 4), label: 'Tracking since' },
  ]

  return (
    <>
      <section className="bg-brand-raised pt-20 pb-16 md:pt-32 md:pb-24">
        <BrandContainer className="flex flex-col gap-10">
          <Link
            href="/pricing-directory"
            className="text-brand-muted hover:text-brand-foreground w-fit text-lg transition-colors"
          >
            ← Directory
          </Link>
          <Caption>{entry.category}</Caption>
          <Display className="max-w-[16ch]">{entry.company}</Display>
          <Lead className="max-w-2xl">{detail.summary}</Lead>
          <div className="border-brand-muted grid grid-cols-2 gap-x-8 gap-y-10 border-t pt-12 md:grid-cols-4 md:pt-16">
            {facts.map((fact) => (
              <div key={fact.label} className="flex flex-col gap-3">
                <span className="text-brand-foreground text-3xl tracking-tight tabular-nums md:text-5xl">
                  {fact.value}
                </span>
                <Caption>{fact.label}</Caption>
              </div>
            ))}
          </div>
        </BrandContainer>
      </section>

      <section className="py-24 md:py-40">
        <BrandContainer className="flex flex-col gap-16 md:gap-24">
          <div className="flex flex-col gap-10 md:gap-14">
            <div className="text-brand-muted flex items-center gap-x-3 text-2xl">
              <span>001</span>
              <span className="bg-brand-muted h-px w-12" />
              <span>History</span>
            </div>
            <Heading className="max-w-5xl">Price history</Heading>
            <Lead>Every tracked change, newest first.</Lead>
          </div>

          <div className="flex flex-col">
            {detail.history.map((point) => (
              <div
                key={point.date}
                className="border-brand-line grid grid-cols-1 gap-2 border-t py-8 first:border-t-0 first:pt-0 md:grid-cols-12 md:items-baseline md:gap-8 md:py-10"
              >
                <Caption className="tabular-nums md:col-span-3">
                  {point.date}
                </Caption>
                <span className="text-brand-foreground text-3xl tracking-tight tabular-nums md:col-span-6 md:text-5xl">
                  {point.value}
                </span>
                <Caption className="md:col-span-3 md:text-right">
                  {directionLabel[point.direction]}
                </Caption>
              </div>
            ))}
          </div>
        </BrandContainer>
      </section>
    </>
  )
}
