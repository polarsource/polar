import React from 'react'
import { BrandSection } from './BrandSection'
import { brandSections } from './brand'
import { Lead, Trait } from './primitives'

const traits = [
  {
    trait: 'Clear',
    description:
      'We communicate with precision. No jargon, no fluff. Every word earns its place.',
  },
  {
    trait: 'Confident',
    description:
      'We know our product and our audience. We speak directly and with conviction.',
  },
  {
    trait: 'Technical',
    description:
      'We respect our developer audience. We use correct terminology and assume intelligence.',
  },
  {
    trait: 'Approachable',
    description:
      'We are experts, not gatekeepers. We welcome questions and encourage exploration.',
  },
]

export function VoiceSection() {
  return (
    <BrandSection
      meta={brandSections[4]}
      title="How Polar speaks"
      lead="The voice is the brand in words. Four principles keep every sentence recognizably Polar."
    >
      <div className="flex flex-col">
        {traits.map((item) => (
          <div
            key={item.trait}
            className="border-brand-line grid grid-cols-1 gap-6 border-t py-12 first:border-t-0 first:pt-0 md:grid-cols-2 md:gap-8 md:py-16"
          >
            <Trait>{item.trait}</Trait>
            <Lead>{item.description}</Lead>
          </div>
        ))}
      </div>
    </BrandSection>
  )
}
