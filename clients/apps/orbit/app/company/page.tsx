import Link from 'next/link'
import { LandingNav } from '../components/landing/LandingNav'
import { LandingFooter } from '../components/landing/LandingFooter'

const JOBS = [
  {
    category: 'Product & Engineering',
    roles: [
      {
        role: 'Senior Platform Engineer',
        location: 'Remote, Europe',
        experience: '5-8+ Years',
        link: 'https://jobs.ashbyhq.com/polar/8a82633e-e7b9-42f4-92e1-33032a56097a',
      },
      {
        role: 'Senior Product Engineer',
        location: 'Remote, Europe',
        experience: '7+ Years',
        link: 'https://jobs.ashbyhq.com/polar/955c6935-6d03-46e5-b649-a8b958a52962',
      },
      {
        role: 'Part-time Support Engineer',
        location: 'Remote, Europe',
        link: 'https://jobs.ashbyhq.com/polar/a47a0dc9-078f-4f80-9bce-29d74bab329b',
      },
    ],
  },
]

const INVESTORS = [
  { name: 'Accel', company: 'Venture Capital Firm' },
  { name: 'Abstract', company: 'Venture Capital Firm' },
  { name: 'Mischief', company: 'Venture Capital Firm' },
  { name: 'Guillermo Rauch', company: 'Vercel' },
  { name: 'Paul Copplestone', company: 'Supabase' },
  { name: 'Tobi Lütke', company: 'Shopify' },
  { name: 'Anton Osika', company: 'Lovable' },
  { name: 'Michael Grinich', company: 'WorkOS' },
  { name: 'Thomas Paul Mann', company: 'Raycast' },
  { name: 'Jorn van Dijk & Koen Bok', company: 'Framer' },
  { name: 'Harley Finkelstein', company: 'Shopify' },
  { name: 'Jared Palmer', company: 'GitHub & Microsoft' },
  { name: 'Zeno Rocha', company: 'Resend' },
  { name: 'Steven Tey', company: 'Dub' },
  { name: 'Sébastien & Alexandre Chopin', company: 'Nuxt' },
  { name: 'Gustaf Alstromer', company: 'Y Combinator' },
  { name: 'Mitchell Hashimoto', company: 'Ghostty' },
  { name: 'David Cramer', company: 'Sentry' },
  { name: 'Carl Rivera', company: 'Shopify' },
  { name: 'Kaj Drobin', company: 'Stilla' },
  { name: 'Siavash Ghorbani', company: 'Stilla' },
  { name: 'Fredrik Björk', company: 'Grafbase' },
  { name: 'Joel Hellermark', company: 'Sana' },
  { name: 'Andrea Wang', company: 'SV Angel' },
  { name: 'Kieran Flanagan', company: 'HubSpot' },
  { name: 'Sri Batchu', company: 'The RealReal' },
  { name: 'Tristan Handy', company: 'dbt Labs' },
  { name: 'Mattias Miksche', company: '\u2014' },
]

const ArrowIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    className="shrink-0"
  >
    <path
      d="M4 12L12 4M12 4H5M12 4V11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default function CompanyPage() {
  return (
    <div className="flex min-h-screen flex-col md:px-16">
      <LandingNav />

      <section className="flex flex-col items-center gap-8 pt-24 pb-48 text-center">
        <h1 className="max-w-4xl text-[clamp(3rem,6vw,6rem)] leading-[1.1] font-normal text-balance text-neutral-900 dark:text-white">
          Small team, big ambitions.
        </h1>
        <p className="max-w-2xl text-3xl leading-relaxed text-balance">
          We&apos;re building the billing layer for the next generation of AI
          products. Come build it with us.
        </p>
      </section>

      <section className="grid grid-cols-1 flex-col gap-8 py-48 md:grid-cols-2">
        <h2 className="text-4xl text-black dark:text-white">
          billing = fn(events)
        </h2>
        <div className="flex flex-col gap-16">
          <div className="flex flex-col gap-6 text-3xl leading-relaxed">
            <p>
              Modern software is priced around usage. Yet billing systems remain
              static.
            </p>
            <p>
              We believe analytics &amp; billing belong in the same platform —
              real-time event ingestion powering instant unit economics and
              analytics, leading to deterministic and versioned billing as code.
            </p>
          </div>
          <div className="flex flex-col gap-6 text-3xl leading-relaxed">
            <p>
              We&apos;re building Polar to become the standard Events &rarr;
              Analytics &rarr; Billing stack for the next generation of
              software.
            </p>
            <p>
              We&apos;re a small team with big ambitions, working with high
              ownership and autonomy. Polar is open source and built in the open
              with our community.
            </p>
          </div>
        </div>
      </section>

      <section id="open-roles" className="py-48">
        <h2 className="text-[clamp(2rem,4vw,4rem)] leading-[1.2] font-normal text-neutral-900 dark:text-white">
          Open Roles
        </h2>
        <div className="mt-16 flex flex-col gap-16">
          {JOBS.map(({ category, roles }) => (
            <div key={category} className="flex flex-col">
              <span className="dark:text-dark-400 pb-6 text-xl text-neutral-400">
                {category}
              </span>
              <div className="flex flex-col">
                {roles.map((job) => (
                  <Link
                    key={job.link}
                    href={job.link}
                    target="_blank"
                    className="dark:border-dark-800 group flex items-center justify-between border-t border-neutral-200 py-8"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-2xl text-neutral-900 group-hover:underline dark:text-white">
                        {job.role}
                      </span>
                      <div className="dark:text-dark-400 flex gap-2 text-xl text-neutral-400">
                        {job.experience && (
                          <>
                            <span>{job.experience}</span>
                            <span>&middot;</span>
                          </>
                        )}
                        <span>{job.location}</span>
                      </div>
                    </div>
                    <ArrowIcon />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-48">
        <div className="flex flex-col gap-6">
          <h2 className="text-[clamp(2rem,4vw,4rem)] leading-[1.2] font-normal text-neutral-900 dark:text-white">
            Investors, Angels &amp; Advisors
          </h2>
          <p className="max-w-2xl text-2xl leading-relaxed">
            The incredible people and early stage firms who have had our back
            through thick and thin — supporting us from Day 1.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-2 gap-x-12 gap-y-8 md:grid-cols-4">
          {INVESTORS.map((investor) => (
            <div key={investor.name} className="flex flex-col gap-1">
              <span className="text-xl text-neutral-900 dark:text-white">
                {investor.name}
              </span>
              <span className="dark:text-dark-400 text-xl text-neutral-400">
                {investor.company}
              </span>
            </div>
          ))}
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
