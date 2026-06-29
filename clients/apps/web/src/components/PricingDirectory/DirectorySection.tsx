'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'
import { BrandContainer, Caption, Heading, Lead } from '../Brand/primitives'
import { categories, ChangeDirection, entries, slugify } from './data'

const directionGlyph: Record<ChangeDirection, string> = {
  up: '↑',
  down: '↓',
  new: '+',
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
        active
          ? 'border-brand-foreground text-brand-foreground'
          : 'border-brand-line text-brand-muted hover:text-brand-foreground'
      }`}
    >
      {label}
    </button>
  )
}

export function DirectorySection() {
  const [category, setCategory] = useState<string>('All')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((entry) => {
      const matchesCategory = category === 'All' || entry.category === category
      const matchesQuery = !q || entry.company.toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    })
  }, [category, query])

  return (
    <section id="directory" className="scroll-mt-24 py-24 md:py-40">
      <BrandContainer className="flex flex-col gap-16 md:gap-24">
        <div className="flex flex-col gap-10 md:gap-14">
          <div className="text-brand-muted flex items-center gap-x-3 text-2xl">
            <span>001</span>
            <span className="bg-brand-muted h-px w-12" />
            <span>Directory</span>
          </div>
          <Heading className="max-w-5xl">The directory</Heading>
          <Lead>
            Every company we track, the model they run, and how often their
            pricing has moved.
          </Lead>
        </div>

        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-6">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search companies"
              className="text-brand-foreground placeholder:text-brand-muted w-full appearance-none border-none bg-transparent text-5xl tracking-tight outline-none focus:ring-0 md:text-7xl"
            />
            <div className="flex flex-wrap gap-3">
              {categories.map((option) => (
                <FilterChip
                  key={option}
                  label={option}
                  active={category === option}
                  onClick={() => setCategory(option)}
                />
              ))}
            </div>
          </div>

          <div className="text-brand-muted border-brand-line hidden grid-cols-12 gap-4 border-b pb-4 text-sm md:grid">
            <span className="col-span-5">Company</span>
            <span className="col-span-2">Model</span>
            <span className="col-span-3">Price anchor</span>
            <span className="col-span-2 text-right">Updated</span>
          </div>

          {filtered.length === 0 ? (
            <Caption>No companies match that filter.</Caption>
          ) : (
            filtered.map((entry) => (
              <Link
                key={entry.company}
                href={`/pricing-directory/${slugify(entry.company)}`}
                className="group border-brand-line grid grid-cols-1 gap-3 border-b py-6 md:grid-cols-12 md:items-center md:gap-4 md:py-5"
              >
                <div className="flex items-baseline gap-3 md:col-span-5">
                  <span className="text-brand-foreground text-xl md:text-2xl">
                    {entry.company}
                  </span>
                  <span className="text-brand-muted text-xl md:text-2xl">
                    {entry.category}
                  </span>
                </div>
                <span className="text-brand-muted group-hover:text-brand-foreground text-lg transition-colors md:col-span-2">
                  {entry.model}
                </span>
                <span className="text-brand-foreground text-lg tabular-nums md:col-span-3">
                  {entry.anchor}
                </span>
                <span className="text-brand-muted tabular-nums md:col-span-2 md:text-right">
                  {entry.lastChange}{' '}
                  <span className="text-brand-foreground">
                    {directionGlyph[entry.direction]}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
      </BrandContainer>
    </section>
  )
}
