import { SectionLabel } from './SectionLabel'

/**
 * LandingTestimonials — four testimonials in a strict 4-column grid
 * with thin vertical dividers.
 */

const TESTIMONIALS = [
  {
    quote:
      "Polar's Python SDK and Webhook infrastructure made our billing integration straightforward.",
    name: 'Siavash Ghorbani',
    role: 'Stilla AI',
  },
  {
    quote:
      'The speed at which Polar is executing on financial infrastructure primitives is impressive.',
    name: 'Guillermo Rauch',
    role: 'Vercel',
  },
  {
    quote:
      'I think it benefits everyone for devs to have more options to get paid for their passions.',
    name: 'Mitchell Hashimoto',
    role: 'Ghostty',
  },
  {
    quote:
      'I went from dreading payments to having everything live in a weekend.',
    name: 'Eric Provencher',
    role: 'Repo Prompt',
  },
]

export const LandingTestimonials = () => (
  <section className="border-b border-neutral-800">
    <div className="border-b border-neutral-800 p-16 py-12">
      <SectionLabel number="005" label="Testimonials" />
    </div>
    <div className="grid grid-cols-4 divide-x divide-neutral-800">
      {TESTIMONIALS.map((t) => (
        <div key={t.name} className="flex flex-col justify-between p-12 py-16">
          {/* Outward arrow */}
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            className="mb-8 text-white"
          >
            <path d="M7 17L17 7" />
            <path d="M7 7H17V17" />
          </svg>
          <p className="text-3xl leading-snug text-white">
            {t.quote}
          </p>
          <div className="mt-12">
            <div className="text-xl text-white">{t.name}</div>
            <div className="text-xl text-neutral-500">{t.role}</div>
          </div>
        </div>
      ))}
    </div>
  </section>
)
