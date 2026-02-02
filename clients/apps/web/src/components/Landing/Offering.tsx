'use client'

import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Section } from './Section'
import AnimatedBars from './animated/AnimatedBars'
import AnimatedFlow from './animated/AnimatedFlow'
import AnimatedInfinity from './animated/AnimatedInfinity'

type OfferingItem = {
  title: string
  description: string
  illustration: React.ReactNode
}

const items: OfferingItem[] = [
  {
    title: 'Billing',
    description:
      'Launch subscription-based software with flexible billing cycles and tier management.',
    illustration: <AnimatedInfinity />,
  },
  {
    title: 'Product Analytics',
    description:
      'Meter and bill for API calls, tokens, or compute with usage-based pricing.',
    illustration: <AnimatedBars />,
  },
  {
    title: 'Revenue Ops',
    description:
      'Track revenue streams, manage payouts, and gain insights across all your monetization channels.',
    illustration: <AnimatedFlow />,
  },
]

type UsecaseCardProps = {
  item: OfferingItem
  className?: string
}

const UsecaseCard = ({ item, className }: UsecaseCardProps) => {
  return (
    <li
      className={twMerge(
        'dark:bg-polar-950 flex h-96 flex-col gap-y-4 bg-white p-6 md:p-8',
        className,
      )}
    >
      <h3 className="text-2xl text-pretty text-black md:text-2xl dark:text-white">
        {item.title}
      </h3>
      <p className="dark:text-polar-500 text-xl text-gray-500">
        {item.description}
      </p>
      <div className="mt-auto flex h-[140px] items-center justify-center">
        {item.illustration}
      </div>
    </li>
  )
}

type OfferingProps = {
  className?: string
}

export const Offering = ({ className }: OfferingProps) => {
  return (
    <Section className={twMerge('flex flex-col gap-y-12', className)}>
      <div className="flex flex-col gap-y-2">
        <h2 className="text-2xl text-black md:text-4xl dark:text-white">
          Built for every use case.
        </h2>
        <p className="dark:text-polar-500 text-2xl text-gray-500 md:text-4xl">
          From payments to product analytics, we&apos;ve got you covered.
        </p>
      </div>
      <div className="dark:bg-polar-800 grid grid-cols-1 gap-px bg-gray-200 p-px xl:grid-cols-3">
        {items.map((item) => (
          <UsecaseCard key={item.title} item={item} />
        ))}
      </div>
    </Section>
  )
}

export default Offering
