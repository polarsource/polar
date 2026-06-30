'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React, { useState } from 'react'
import { Option, UNIT_OPTIONS } from './compareOptions'

function Chip({
  option,
  active,
  onClick,
}: {
  option: Option
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
      {option.label}
    </button>
  )
}

export function ComparisonControls({
  featureOptions,
}: {
  featureOptions: Option[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const mode = params.get('mode') === 'features' ? 'features' : 'prices'
  const [text, setText] = useState(params.get('q') ?? '')

  const push = (next: URLSearchParams) => {
    router.push(`${pathname}?${next.toString()}`)
  }

  const setMode = (next: string) => {
    setText('')
    push(new URLSearchParams({ mode: next }))
  }

  const selectFacet = (key: string, value: string) => {
    setText('')
    push(new URLSearchParams({ mode, [key]: value }))
  }

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const next = new URLSearchParams({ mode })
    if (text.trim()) next.set('q', text.trim())
    push(next)
  }

  const facetKey = mode === 'prices' ? 'unit' : 'key'
  const options = mode === 'prices' ? UNIT_OPTIONS : featureOptions
  const activeFacet = params.get(facetKey)

  return (
    <div className="flex flex-col gap-10">
      <div className="flex gap-8">
        {['prices', 'features'].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`text-2xl tracking-tight transition-colors md:text-3xl ${
              mode === value
                ? 'text-brand-foreground'
                : 'text-brand-muted hover:text-brand-foreground'
            }`}
          >
            {value === 'prices' ? 'Prices' : 'Features'}
          </button>
        ))}
      </div>

      {mode === 'prices' ? (
        <form onSubmit={submitSearch}>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Compare any unit, e.g. workspace"
            className="text-brand-foreground placeholder:text-brand-muted w-full appearance-none border-none bg-transparent p-0 text-4xl tracking-tight outline-none focus:ring-0 md:text-6xl"
          />
        </form>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <Chip
            key={option.value}
            option={option}
            active={activeFacet === option.value}
            onClick={() => selectFacet(facetKey, option.value)}
          />
        ))}
      </div>
    </div>
  )
}
