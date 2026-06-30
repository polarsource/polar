import Link from 'next/link'
import React from 'react'
import { Caption } from '../Brand/primitives'
import { ComparisonRow } from './types'

function groupByUnit(rows: ComparisonRow[]): Map<string, ComparisonRow[]> {
  const groups = new Map<string, ComparisonRow[]>()
  for (const row of rows) {
    const group = groups.get(row.unit) ?? []
    group.push(row)
    groups.set(row.unit, group)
  }
  return groups
}

export function PriceComparison({ rows }: { rows: ComparisonRow[] }) {
  if (rows.length === 0) {
    return <Caption>No prices match. Try a different unit or search.</Caption>
  }

  return (
    <div className="flex flex-col gap-16">
      {[...groupByUnit(rows)].map(([unit, items]) => {
        const max = Math.max(...items.map((row) => row.unitPrice))
        return (
          <div key={unit} className="flex flex-col gap-4">
            <Caption>
              {unit} · {items.length}
            </Caption>
            <div className="flex flex-col">
              {items.map((row) => (
                <Link
                  key={`${row.companySlug}-${row.product}-${row.label}`}
                  href={`/pricing-directory/${row.companySlug}`}
                  className="group border-brand-line flex flex-col gap-2 border-t py-4 first:border-t-0"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="flex items-baseline gap-3">
                      <span className="text-brand-foreground text-lg md:text-xl">
                        {row.company}
                      </span>
                      <Caption className="text-base">{row.product}</Caption>
                    </div>
                    <span className="text-brand-foreground text-lg tabular-nums md:text-xl">
                      {row.label}
                    </span>
                  </div>
                  <div className="bg-brand-line h-1.5 w-full overflow-hidden">
                    <div
                      className="bg-brand-foreground h-1.5"
                      style={{ width: `${max > 0 ? (row.unitPrice / max) * 100 : 0}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
