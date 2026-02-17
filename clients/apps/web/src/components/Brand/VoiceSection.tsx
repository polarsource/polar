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
      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-24">
          {traits.map((item) => (
            <div key={item.trait} className="grid grid-cols-2 gap-48">
              <span className="text-9xl font-light tracking-tighter">
                {item.trait}
              </span>
              <p className="dark:text-polar-500 max-w-xl text-2xl leading-relaxed text-neutral-500">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </SectionLayout>
  )
}
