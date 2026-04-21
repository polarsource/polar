import { twMerge } from 'tailwind-merge'
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
  <section>
    <div className="grid grid-cols-4">
      {TESTIMONIALS.map((t, i) => (
        <div
          key={t.name}
          className={twMerge(
            'flex flex-col justify-between gap-y-16 p-12 py-24',
            i % 2 === 0 ? 'bg-neutral-900' : 'bg-neutral-800',
          )}
        >
          {/* Outward arrow */}
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            className="text-white"
          >
            <path d="M7 17L17 7" />
            <path d="M7 7H17V17" />
          </svg>
          <p className="text-3xl leading-snug text-white">{t.quote}</p>
          <div>
            <div className="text-xl text-white">{t.name}</div>
            <div className="text-xl text-neutral-500">{t.role}</div>
          </div>
        </div>
      ))}
    </div>
  </section>
)
