import React from 'react'
import { BrandSection } from './BrandSection'
import { brandSections } from './brand'
import { Label, Specimen } from './primitives'

const invoice = [
  { label: 'Tokens', value: '1,284,302' },
  { label: 'Rate', value: '$0.0032' },
  { label: 'Total', value: '$4,109.77', total: true },
]

export function TypographySection() {
  return (
    <BrandSection
      meta={brandSections[2]}
      title="PP Neue Montreal"
      lead="PP Neue Montreal is the single typeface of the identity, chosen for its clarity and structured geometry. Geist Mono carries technical detail like code and data."
    >
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="bg-brand-raised flex flex-col gap-8 overflow-hidden p-8 md:p-16">
          <Label>PP Neue Montreal</Label>
          <Specimen>Usage billing</Specimen>
          <span className="text-brand-muted text-3xl md:text-4xl">
            Meter every token. Invoice every cent.
          </span>
        </div>
        <div className="bg-brand-raised flex flex-col gap-8 overflow-hidden p-8 md:p-16">
          <Label>Geist Mono</Label>
          <Specimen>Usage</Specimen>
          <div className="flex flex-col gap-2 font-mono text-xl tabular-nums md:text-2xl">
            {invoice.map((row) => (
              <div
                key={row.label}
                className={`flex items-baseline justify-between gap-6 ${row.total ? 'border-brand-line text-brand-foreground border-t pt-3' : 'text-brand-muted'}`}
              >
                <span>{row.label}</span>
                <span className="text-brand-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrandSection>
  )
}
