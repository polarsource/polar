'use client'

import { Headline } from '@/components/Orbit/Headline'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { CompanyNav } from '../CompanyNav'

const values = [
  {
    title: 'Momentum is Culture',
    description:
      'We focus on keeping, celebrating and accelerating momentum. Allowing culture to be continuously improved and fluid vs. fixed.',
  },
  {
    title: 'Ship / Refactor / Scale',
    description:
      'Our #1 focus and drive is shipping and growing great product experiences that solves real problems for developers and their users.',
  },
  {
    title: "Do your life's work",
    description:
      "We're not a 9-5 nor 24/7. We don't track time nor search for people who count it down. But we continuously push the envelope of our creativity & productivity.",
  },
]

const openings = [
  {
    department: 'Product & Engineering',
    jobs: [
      {
        role: 'Staff Infrastructure Engineer',
        description:
          'Own the end-to-end architecture and implementation of our infrastructure to ensure world-class uptime and latency.',
        location: 'Remote — Europe',
        experience: '8+ Years Experience',
        link: 'https://jobs.ashbyhq.com/polar/e610cfb0-a883-4138-aef0-f826f82958cb',
      },
      {
        role: 'Senior Product Engineer',
        description:
          'Ship features, APIs and SDKs that empowers the next generation of developers to build businesses.',
        location: 'Remote — Europe',
        experience: '7+ Years Experience',
        link: 'https://jobs.ashbyhq.com/polar/955c6935-6d03-46e5-b649-a8b958a52962',
      },
      {
        role: 'Senior Growth Engineer',
        description:
          'Design and ship growth-focused features, enhancements and experiments end-to-end.',
        location: 'Remote — Europe',
        experience: '7+ Years Experience',
        link: 'https://jobs.ashbyhq.com/polar/1496592e-16ff-47e7-b11e-a993c887fc1f',
      },
    ],
  },
  {
    department: 'Customer Success',
    jobs: [
      {
        role: 'Support Engineer',
        description:
          'Help provide exceptional support to developers world-wide and scale our efforts by improving docs, guides and internal tooling.',
        location: 'Remote — Europe',
        experience: '2+ Years Experience',
        link: 'https://jobs.ashbyhq.com/polar/3b7b5522-3781-4a6b-b112-5ad93320192a',
      },
    ],
  },
]

export default function CareersPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-y-24 px-8 py-12 md:px-12">
      <CompanyNav />

      <Headline as="h1" text="Careers" animate />

      <motion.div
        className="flex flex-col gap-24"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.2 }}
      >
        {/* Values */}
        <div className="grid grid-cols-5 gap-32">
          <div className="col-span-1 pt-0.5">
            <Headline text="Values" as="span" />
          </div>
          <div className="col-span-4 grid grid-cols-3 gap-8">
            {values.map(({ title, description }) => (
              <div key={title} className="flex flex-col gap-2">
                <span className="text-sm font-medium text-black dark:text-white">
                  {title}
                </span>
                <p className="dark:text-polar-400 text-sm leading-relaxed text-neutral-500">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Open roles */}
        {openings.map(({ department, jobs }) => (
          <div key={department} className="grid grid-cols-5 gap-32">
            <div className="col-span-1 pt-0.5">
              <Headline text={department} as="span" />
            </div>
            <div className="dark:divide-polar-800 col-span-4 flex flex-col divide-y divide-neutral-200">
              {jobs.map(({ role, description, location, experience, link }) => (
                <Link
                  key={role}
                  href={link}
                  target="_blank"
                  className="group grid grid-cols-3 gap-8 py-6 transition-opacity hover:opacity-70"
                >
                  <div className="col-span-2 flex flex-col gap-1">
                    <span className="text-sm font-medium text-black dark:text-white">
                      {role}
                    </span>
                    <p className="dark:text-polar-400 text-sm leading-relaxed text-neutral-500">
                      {description}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="dark:text-polar-500 text-xs text-neutral-400">
                      {location}
                    </span>
                    <span className="dark:text-polar-500 text-xs text-neutral-400">
                      {experience}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}
