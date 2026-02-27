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
    <SectionLayout label="Voice & Tone">
      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-12 md:gap-24">
          {traits.map((item) => (
            <div
              key={item.trait}
              className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-48"
            >
              {/* eslint-disable-next-line no-restricted-syntax */}
              <span className="text-5xl font-light tracking-tighter md:text-9xl">
                {item.trait}
              </span>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <p className="dark:text-polar-500 max-w-xl text-base leading-relaxed text-neutral-500 md:text-2xl">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </SectionLayout>
  )
}
