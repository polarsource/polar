import Link from 'next/link'
import React from 'react'
import { BrandContainer, Caption, Heading, Lead } from '../Brand/primitives'
import { Answers, recommend } from './advisor'
import { Company } from './types'

export function AdvisorResult({
  answers,
  companies,
  onRestart,
}: {
  answers: Answers
  companies: Company[]
  onRestart: () => void
}) {
  const result = recommend(answers, companies)

  const params = new URLSearchParams({ source: 'pricing-advisor' })
  params.set(
    'pricing',
    result.model
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, ''),
  )
  for (const [key, value] of Object.entries(answers)) {
    if (value) params.set(key, value)
  }
  const signupHref = `/signup?${params.toString()}`

  return (
    <BrandContainer className="flex flex-col gap-12 py-20 md:gap-16 md:py-32">
      <div className="flex flex-col gap-16">
        <Caption>Your pricing approach</Caption>
        <Heading className="max-w-[16ch]">{result.model}</Heading>
        <Lead className="max-w-2xl">{result.rationale}</Lead>
      </div>

      <div className="flex flex-col gap-6">
        <Caption>Where to start</Caption>
        <ul className="flex flex-col">
          {result.mechanics.map((mechanic) => (
            <li
              key={mechanic}
              className="border-brand-line text-brand-foreground border-t py-5 text-xl first:border-t-0 first:pt-0 md:text-2xl"
            >
              {mechanic}
            </li>
          ))}
        </ul>
      </div>

      {result.comparables.length > 0 ? (
        <div className="flex flex-col gap-6">
          <Caption>Companies pricing this way</Caption>
          <div className="flex flex-col">
            {result.comparables.map((comparable) => (
              <Link
                key={`${comparable.slug}-${comparable.product}`}
                href={`/pricing-directory/${comparable.slug}`}
                className="group border-brand-line flex items-baseline justify-between gap-4 border-t py-5 first:border-t-0 first:pt-0"
              >
                <span className="flex items-baseline gap-3">
                  <span className="text-brand-foreground text-xl md:text-2xl">
                    {comparable.name}
                  </span>
                  <Caption>{comparable.product}</Caption>
                </span>
                <span className="text-brand-muted group-hover:text-brand-foreground text-lg tabular-nums transition-colors">
                  {comparable.anchor}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 pt-4">
        <Link
          href={signupHref}
          className="bg-brand-foreground text-brand-surface rounded-full px-6 py-3 text-lg transition-opacity hover:opacity-80"
        >
          Get started with Polar
        </Link>
        <Link
          href="/pricing-directory#directory"
          className="border-brand-line text-brand-foreground hover:border-brand-foreground rounded-full border px-6 py-3 text-lg transition-colors"
        >
          Explore the directory
        </Link>
      </div>
    </BrandContainer>
  )
}
