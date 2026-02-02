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
          <h2 className="dark:text-polar-500 text-3xl leading-tight text-gray-500 md:text-5xl md:leading-tight">
            <span className="text-black dark:text-white">
              Billing is a crucial part of your customer relationship, but only
              a part of it.
            </span>{' '}
            We aim to bridge the gap between product analytics, CRM, and
            billing, providing a comprehensive platform for startups to scale
            their business.
          </h2>
        </div>
      </div>
    </Section>
  )
}

export default Purpose
