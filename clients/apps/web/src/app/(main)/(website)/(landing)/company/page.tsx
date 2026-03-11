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
        role: 'Staff Infrastructure Engineer',
        description:
          'Own the end-to-end architecture and implementation of our infrastructure to ensure world-class uptime and latency.',
        location: 'Remote, Europe',
        experience: '8+ Years',
        link: 'https://jobs.ashbyhq.com/polar/e610cfb0-a883-4138-aef0-f826f82958cb',
      },
      {
        role: 'Senior Product Engineer',
        description:
          'Ship features, APIs and SDKs that empowers the next generation of developers to build businesses.',
        location: 'Remote, Europe',
        experience: '7+ Years',
        link: 'https://jobs.ashbyhq.com/polar/955c6935-6d03-46e5-b649-a8b958a52962',
      },
      {
        role: 'Senior Growth Engineer',
        description:
          'Design and ship growth-focused features, enhancements and experiments end-to-end.',
        location: 'Remote, Europe',
        experience: '7+ Years',
        link: 'https://jobs.ashbyhq.com/polar/1496592e-16ff-47e7-b11e-a993c887fc1f',
      },
    ],
  },
  {
    category: 'Customer Success',
    roles: [
      {
        role: 'Support Engineer',
        description:
          'Help provide exceptional support to developers world-wide and scale our efforts by improving docs, guides and internal tooling.',
        location: 'Remote, Europe',
        experience: '2+ Years',
        link: 'https://jobs.ashbyhq.com/polar/3b7b5522-3781-4a6b-b112-5ad93320192a',
      },
    ],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompanyPage() {
  return (
    <div className="dark:bg-polar-950 min-h-screen bg-white text-gray-900 dark:text-white">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 px-6 py-24 text-center">
        <h1 className="font-display leading-tighter max-w-2xl text-5xl font-medium text-balance md:text-7xl">
          Small team, big ambitions.
        </h1>
        <p className="dark:text-polar-500 max-w-xl text-lg text-balance text-gray-500">
          We&apos;re building the billing layer for the next generation of AI
          products. Come build it with us.
        </p>
        <a
          href="#open-roles"
          className="mt-2 inline-flex items-center rounded-full bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-gray-900"
        >
          Join Us
        </a>
      </section>

      <TeamCarouselWrapper />

      {/* About */}
      <section className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-24">
        <h2 className="font-display text-2xl font-medium md:text-4xl">
          We believe the next unicorns will be created by individual developers.
        </h2>
        <div className="flex flex-col gap-4 text-lg leading-relaxed">
          <p>
            As lines blur between indie hackers, startups, and enterprises,
            we&apos;re building Polar to empower solo builders and early-stage
            startups — the future enterprises, without the headcount.
          </p>
          <p>
            Polar is a small team with big ambitions, empowered by a culture of
            ownership and autonomy. We&apos;re proud to be open source and built
            for transparency to shape the future with our community.
          </p>
        </div>
        <div className="flex flex-col gap-1 text-lg">
          <Link
            href="https://github.com/polarsource"
            target="_blank"
            className="hover:text-gray-900 dark:hover:text-white"
          >
            Polar on GitHub →
          </Link>
          <Link
            href="https://x.com/polar_sh"
            target="_blank"
            className="hover:text-gray-900 dark:hover:text-white"
          >
            Join the conversation →
          </Link>
        </div>
      </section>

      {/* Open roles */}
      <section id="open-roles">
        <div className="mx-auto max-w-3xl px-6 py-16">
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
                      className="dark:border-polar-800 group grid grid-cols-1 gap-4 border-t border-gray-100 py-6 md:grid-cols-2"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium group-hover:underline">
                          {job.role}
                        </span>
                        <div className="dark:text-polar-500 flex flex-row gap-x-4 text-gray-500">
                          <span>{job.experience}</span>
                          <span>·</span>
                          <span>{job.location}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
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
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="mb-12 flex flex-col gap-3">
            <h2 className="font-display text-3xl font-medium">
              Investors, Angels & Advisors
            </h2>
            <p className="text-lg">
              The incredible people and early stage firms who have had our back
              through thick and thin — supporting us from Day 1.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            {investors.map((investor) => (
              <div key={investor.name} className="flex flex-col gap-0.5">
                <span className="font-medium">{investor.name}</span>
                <span className="dark:text-polar-500 text-gray-400">
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
