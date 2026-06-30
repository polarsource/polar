import Link from 'next/link'
import React from 'react'
import { Caption } from '../Brand/primitives'
import { GatingRow } from './types'

export function FeatureGating({
  rows,
  featureLabel,
}: {
  rows: GatingRow[]
  featureLabel: string
}) {
  if (rows.length === 0) {
    return <Caption>No tracked plan includes {featureLabel} yet.</Caption>
  }

  return (
    <div className="flex flex-col gap-4">
      <Caption>
        Cheapest plan that includes {featureLabel} · {rows.length}
      </Caption>
      <div className="flex flex-col">
        {rows.map((row) => (
          <Link
            key={row.companySlug}
            href={`/pricing-directory/${row.companySlug}`}
            className="group border-brand-line grid grid-cols-12 items-baseline gap-4 border-t py-4 first:border-t-0"
          >
            <span className="text-brand-foreground group-hover:text-brand-muted col-span-5 text-lg transition-colors md:text-xl">
              {row.company}
            </span>
            <span className="text-brand-muted col-span-4 flex items-baseline gap-2 text-base md:text-lg">
              {row.plan}
              {row.value ? <Caption>{row.value}</Caption> : null}
            </span>
            <span className="text-brand-foreground col-span-3 text-right text-lg tabular-nums md:text-xl">
              {row.anchor}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
