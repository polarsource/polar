import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Link from 'next/link'
import { investors } from './investors'
import { TeamCarouselWrapper } from './TeamCarouselWrapper'

// ── Data ──────────────────────────────────────────────────────────────────────

const JOBS = [
  {
    category: 'Product & Engineering',
    roles: [
      {
        role: 'Senior Compliance & Risk Engineer',
        location: 'Remote, Europe',
        experience: '5+ Years',
        link: 'https://jobs.ashbyhq.com/polar/c65b092e-0a5b-4e7f-a2ca-ab5bf559765f',
      },
      {
        role: 'Senior Payments Engineer',
        location: 'Remote, Europe',
        experience: '5-8+ Years',
        link: 'https://jobs.ashbyhq.com/polar/d193753e-ffa6-46bb-90da-d735cb8428f3',
      },
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
        role: 'Technical Support Lead',
        location: 'Remote, Europe',
        link: 'https://jobs.ashbyhq.com/polar/4adb9a30-28d1-4db1-a7bf-80a07bfea337',
      },
    ],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompanyPage() {
  return (
    <div className="dark:bg-polar-950 min-h-screen bg-white text-gray-900 dark:text-white">
      {/* Hero */}
      <section className="flex flex-col items-center gap-8 pt-12 pb-24 text-center md:px-4">
        <h1 className="font-display leading-tighter max-w-2xl text-5xl font-medium text-balance md:text-7xl">
          Small team, big ambitions.
        </h1>
        <p className="max-w-xl text-lg text-balance">
          We&apos;re building the billing layer for the next generation of AI
          products. Come build it with us.
        </p>
        <a
          href="#open-roles"
          className="mt-2 inline-flex items-center rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-gray-900"
        >
          Join Us
        </a>
      </section>

      <TeamCarouselWrapper />

      {/* About */}
      <section className="mx-auto flex w-full max-w-xl flex-col gap-8 py-24 md:px-6">
        <h2 className="font-display text-2xl font-medium md:text-4xl">
          billing = fn(events)
        </h2>
        <div className="flex flex-col gap-4 text-lg leading-relaxed">
          <p>
            Modern software is priced around usage. Yet billing systems remain
            static.
          </p>
          <p>
            We believe analytics & billing belong in the same platform —
            real-time event ingestion powering instant unit economics and
            analytics, leading to deterministic and versioned billing as code.
          </p>
          <p>
            We&apos;re building Polar to become the standard Events → Analytics
            → Billing stack for the next generation of software.
          </p>
          <p>
            We&apos;re a small team with big ambitions, working with high
            ownership and autonomy. Polar is open source and built in the open
            with our community.
          </p>
        </div>
      </section>

      {/* Open roles */}
      <section id="open-roles">
        <div className="mx-auto max-w-xl py-16 md:px-6">
          <h2 className="font-display mb-16 text-3xl font-medium">
            Open Roles
          </h2>
          <div className="flex flex-col gap-16">
            {JOBS.map(({ category, roles }) => (
              <div key={category} className="flex flex-col gap-4">
                <h3 className="text-lg">{category}</h3>
                <div className="flex flex-col">
                  {roles.map((job) => (
                    <Link
                      key={job.link}
                      href={job.link}
                      target="_blank"
                      className="dark:border-polar-800 group flex flex-row items-baseline justify-between gap-4 border-t border-gray-100 py-6"
                    >
                      <div className="flex flex-1 flex-col gap-1">
                        <span className="font-medium group-hover:underline">
                          {job.role}
                        </span>
                        <div className="dark:text-polar-500 flex flex-row gap-x-2 text-gray-500">
                          {job.experience && (
                            <>
                              <span>{job.experience}</span>
                              <span>·</span>
                            </>
                          )}
                          <span>{job.location}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <ArrowOutwardOutlined fontSize="inherit" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Investors */}
      <section>
        <div className="mx-auto max-w-xl py-16 md:px-6">
          <div className="mb-12 flex flex-col gap-3">
            <h2 className="font-display text-3xl font-medium">
              Investors, Angels & Advisors
            </h2>
            <p className="text-lg">
              The incredible people and early stage firms who have had our back
              through thick and thin — supporting us from Day 1.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {investors.map((investor) => (
              <div key={investor.name} className="flex flex-col gap-0.5">
                <span className="font-medium">{investor.name}</span>
                <span className="dark:text-polar-500 text-gray-500">
                  {investor.company}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
