'use client'

import { twMerge } from 'tailwind-merge'
import { Section } from './Section'

type PurposeProps = {
  className?: string
}

export const Purpose = ({ className }: PurposeProps) => {
  return (
    <Section className={twMerge('flex flex-col gap-y-12', className)}>
      <div className="flex flex-col gap-y-12 md:flex-row md:gap-x-12">
        <div className="flex flex-col">
          <h2 className="text-3xl leading-tight text-gray-500 dark:text-polar-500 md:text-5xl md:leading-tight">
          <span className='text-black dark:text-white'>We believe the next unicorns will be created by individual developers.</span> As lines blur between indie hackers, startups, and enterprises, we&apos;re building Polar to empower solo builders and early-stage startups.
          </h2>
        </div>
      </div>
    </Section>
  )
}

export default Purpose
