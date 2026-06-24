import React from 'react'
import { BrandSection } from './BrandSection'
import { brandSections } from './brand'

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
      meta={brandSections[3]}
      title="How Polar speaks"
      lead="The voice is the brand in words. Four principles keep every sentence recognizably Polar."
    >
      <div className="flex flex-col">
        {traits.map((item, index) => (
          <div
            key={item.trait}
            className="grid grid-cols-1 gap-6 border-t border-[#1D1E22] py-12 first:border-t-0 first:pt-0 md:grid-cols-12 md:gap-8 md:py-16"
          >
            <span className="font-mono text-sm text-[#575757] md:col-span-1">
              0{index + 1}
            </span>
            <h3 className="text-4xl font-[350] tracking-tight text-[#575757] md:col-span-5 md:text-6xl">
              {item.trait}
            </h3>
            <p className="text-lg leading-relaxed text-[#575757] md:col-span-6 md:text-2xl">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </BrandSection>
  )
}
