import React from 'react'
import { SectionLayout } from './SectionLayout'

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
    <SectionLayout label="07 / Voice & Tone">
      <div className="flex max-w-2xl flex-col gap-10">
        <div className="flex flex-col gap-6">
          {traits.map((item) => (
            <div key={item.trait} className="flex gap-8">
              <span className="w-28 shrink-0 text-lg font-semibold">
                {item.trait}
              </span>
              <p className="text-base leading-relaxed text-neutral-500">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </SectionLayout>
  )
}
