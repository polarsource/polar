import Link from 'next/link'

const TESTIMONIALS = [
  {
    quote:
      "Polar's Python SDK and Webhook infrastructure made our billing integration straightforward. It gave us production-ready billing in hours, not weeks.",
    name: 'Siavash Ghorbani',
    role: 'Stilla AI',
    link: '/customers/stilla-ai',
  },
  {
    quote:
      'The speed at which Polar is executing on the financial infrastructure primitives the new world needs is very impressive.',
    name: 'Guillermo Rauch',
    role: 'Vercel',
    link: 'https://x.com/rauchg/status/1909810055622672851',
  },
  {
    quote:
      "I've joined Polar as an advisor! I think it benefits everyone for devs to have more options to get paid to work on their passions, to support upstreams, and for users to have more confidence in the software they're supporting.",
    name: 'Mitchell Hashimoto',
    role: 'Ghostty',
    link: 'https://x.com/mitchellh/status/1775925951668552005',
  },
  {
    quote: 'I switched to Polar a few weeks back. Best decision ever.',
    name: 'Lee Black',
    role: '1042 Studio',
    link: 'https://x.com/mrblackstudio/status/1987257923291259224',
  },
]

export const LandingTestimonials = () => (
  <section className="mb-2">
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
      {TESTIMONIALS.map((t) => (
        <Link
          key={t.name}
          href={t.link}
          target="_blank"
          className="dark:bg-dark-900 dark:hover:bg-dark-800 flex flex-col justify-between gap-y-16 bg-neutral-50 p-10 py-16 transition-colors hover:bg-neutral-100"
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            className="text-neutral-900 dark:text-white"
          >
            <path d="M7 17L17 7" />
            <path d="M7 7H17V17" />
          </svg>
          <p className="h-full text-3xl leading-snug text-neutral-900 dark:text-white">
            {t.quote}
          </p>
          <div>
            <div className="text-2xl text-neutral-900 dark:text-white">
              {t.name}
            </div>
            <div className="dark:text-dark-400 text-2xl text-neutral-400">
              {t.role}
            </div>
          </div>
        </Link>
      ))}
    </div>
  </section>
)
