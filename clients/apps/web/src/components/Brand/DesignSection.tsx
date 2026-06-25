import React from 'react'
import { BrandSection } from './BrandSection'
import { brandSections } from './brand'
import { Lead, Mono, Trait } from './primitives'

const principles = [
  {
    name: 'Design by subtraction',
    description:
      'Start with everything. Remove until only what is necessary remains. Then remove one more thing. What survives is the design.',
  },
  {
    name: 'Derived, not decorated',
    description:
      'Every visual element should feel like it emerged from an underlying rule, not from personal preference.',
  },
  {
    name: 'Precision as respect',
    description:
      'Our audience is technical. They pattern-match fast and trust slowly. Anything imprecise signals that we do not understand their world.',
  },
]

export function DesignSection() {
  return (
    <BrandSection
      meta={brandSections[6]}
      title="How Polar designs"
      lead="Design at Polar is not how things look. The best design we will ever produce is a billing infrastructure so precise, so automatic, and so well-considered that the founders using it stop thinking about billing entirely."
    >
      <div className="flex flex-col">
        {principles.map((principle, index) => (
          <div
            key={principle.name}
            className="grid grid-cols-1 gap-6 border-t border-brand-line py-12 first:border-t-0 first:pt-0 md:grid-cols-12 md:gap-8 md:py-16"
          >
            <Mono className="md:col-span-1">0{index + 1}</Mono>
            <Trait className="md:col-span-5">{principle.name}</Trait>
            <Lead className="md:col-span-6">{principle.description}</Lead>
          </div>
        ))}
      </div>
    </BrandSection>
  )
}
