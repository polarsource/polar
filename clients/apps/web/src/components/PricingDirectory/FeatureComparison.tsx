import Link from 'next/link'
import React from 'react'
import { Caption } from '../Brand/primitives'
import { FeatureRow } from './types'

function groupByKey(rows: FeatureRow[]): Map<string, FeatureRow[]> {
  const groups = new Map<string, FeatureRow[]>()
  for (const row of rows) {
    const group = groups.get(row.key) ?? []
    group.push(row)
    groups.set(row.key, group)
  }
  return groups
}

export function FeatureComparison({ rows }: { rows: FeatureRow[] }) {
  if (rows.length === 0) {
    return <Caption>No features match. Try a category or search.</Caption>
  }

  return (
    <div className="flex flex-col gap-12">
      {[...groupByKey(rows)].map(([key, items]) => (
        <div key={key} className="flex flex-col gap-3">
          <div className="border-brand-line flex items-baseline justify-between gap-4 border-b pb-2">
            <span className="text-brand-foreground text-xl md:text-2xl">
              {items[0].name}
            </span>
            <Caption>
              {items[0].category} · {items.length}
            </Caption>
          </div>
          {items.map((row) => (
            <Link
              key={`${row.companySlug}-${row.product}`}
              href={`/pricing-directory/${row.companySlug}`}
              className="group grid grid-cols-12 items-baseline gap-4 py-1 text-base md:text-lg"
            >
              <span className="text-brand-foreground group-hover:text-brand-muted col-span-5 transition-colors">
                {row.company}
              </span>
              <span className="text-brand-muted col-span-4">{row.product}</span>
              <span className="text-brand-foreground col-span-3 text-right">
                {row.value ?? 'Included'}
              </span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  )
}
