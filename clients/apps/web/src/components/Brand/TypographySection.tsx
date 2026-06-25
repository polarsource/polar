import React from 'react'
import { BrandSection } from './BrandSection'
import { brandSections } from './brand'
import { Label, Specimen } from './primitives'

const weights = [
  { name: 'Light', className: 'font-light' },
  { name: 'Regular', className: 'font-normal' },
  { name: 'Medium', className: 'font-medium' },
  { name: 'SemiBold', className: 'font-semibold' },
]

export function TypographySection() {
  return (
    <BrandSection
      meta={brandSections[2]}
      title="PP Neue Montreal"
      lead="PP Neue Montreal is the single typeface of the identity, chosen for its clarity and structured geometry. GeistMono carries technical detail like code and data."
    >
      <div className="flex flex-col gap-12 md:gap-16">
        <div className="bg-brand-raised flex flex-col gap-8 overflow-hidden p-8 md:p-16">
          <Specimen>Montreal</Specimen>
          <Specimen tone="muted">AaBbCc</Specimen>
          <Specimen tone="muted">0123456789</Specimen>
        </div>
        <div className="grid grid-cols-1 gap-8 overflow-hidden sm:grid-cols-2 md:grid-cols-4">
          {weights.map((weight) => (
            <div
              key={weight.name}
              className="bg-brand-raised flex flex-col justify-between gap-12 p-8 md:p-10"
            >
              <Label>{weight.name}</Label>
              <span
                className={`text-brand-foreground text-7xl tracking-tight ${weight.className}`}
              >
                Ag
              </span>
            </div>
          ))}
        </div>
      </div>
    </BrandSection>
  )
}
