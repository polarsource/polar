import React from 'react'
import { BrandSection } from './BrandSection'
import { brandSections } from './brand'

const weights = [
  { name: 'Light', className: '' },
  { name: 'Regular', className: 'font-normal' },
  { name: 'Medium', className: 'font-medium' },
  { name: 'SemiBold', className: 'font-semibold' },
]

const specimenClass =
  'text-[clamp(3rem,12vw,11rem)] leading-[0.85]  tracking-tight font-[350]'

export function TypographySection() {
  return (
    <BrandSection
      meta={brandSections[2]}
      title="Neue Montreal, set with intent"
      lead="PP Neue Montreal is the single typeface of the identity, chosen for its clarity and structured geometry. GeistMono carries technical detail like code and data."
    >
      <div className="flex flex-col gap-12 md:gap-16">
        <div className="flex flex-col gap-4 overflow-hidden bg-[#171717] p-8 md:p-16">
          <span className={`${specimenClass} text-[#ADADAD]`}>Montreal</span>
          <span className={`${specimenClass} text-[#575757]`}>AaBbCc</span>
          <span className={`${specimenClass} text-[#575757]`}>0123456789</span>
        </div>
        <div className="grid grid-cols-1 gap-8 overflow-hidden sm:grid-cols-2 md:grid-cols-4">
          {weights.map((weight) => (
            <div
              key={weight.name}
              className="flex flex-col justify-between gap-12 bg-[#171717] p-8 md:p-10"
            >
              <span className="text-lg text-[#575757]">{weight.name}</span>
              <span
                className={`text-7xl font-[350] tracking-tight text-[#575757] ${weight.className}`}
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
