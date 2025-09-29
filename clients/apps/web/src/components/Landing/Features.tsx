'use client'

import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Console } from '../Vision/Console'

type FeatureCardProps = {
  title: string
  description: string | React.ReactNode
  linkHref: string
  className?: string
  children?: React.ReactNode
}

const FeatureCard = ({
  title,
  description,
  linkHref,
  className,
  children,
}: FeatureCardProps) => {
  return (
    <div className={twMerge('flex flex-col gap-y-6', className)}>
      <Link
        href={linkHref}
        target="_blank"
        className={twMerge(
          'dark:border-polar-700 dark:bg-polar-900 p-6! flex h-full flex-col justify-between gap-x-6 gap-y-6 rounded-2xl border border-transparent bg-white transition-transform hover:translate-y-[-4px] md:p-10 xl:gap-y-0',
        )}
      >
        <div className="flex h-full flex-col gap-y-6">
          <div className="flex h-full flex-col gap-y-2 md:gap-y-6">
            <h3 className="md:leading-tight! text-pretty text-xl text-black md:text-3xl dark:text-white">
              {title}
            </h3>
            {typeof description === 'string' ? (
              <p className="dark:text-polar-500 w-full grow text-lg text-gray-500 md:max-w-96">
                {description}
              </p>
            ) : (
              description
            )}
          </div>
        </div>
      </div>
      {children}
    </Link>
  )
}

type FeaturesProps = {
  className?: string
}

const Features = ({ className }: FeaturesProps) => {
  const features = [
    {
      title: 'Payments, Usage & Billing',
      description:
        'Create digital products & SaaS billing with flexible pricing models and seamless payment processing.',
      linkHref: 'https://polar.sh/docs/features/products',
      children: (
        <div className="flex flex-col">
          {[
            'Subscriptions',
            'Usage Billing',
            'Benefits',
            'Customer Portal',
            'Checkout Links',
            'Metrics',
          ].map((item, index) => (
            <span
              className="dark:text-polar-50 text-xs text-gray-950"
              key={index}
            >
              {`> ${item}`}
            </span>
          ))}
        </div>
      ),
    },
    {
      title: 'Global Merchant of Record',
      description:
        'Focus on your passion while we handle all headaches & tax compliance.',
      linkHref: 'https://polar.sh/docs/merchant-of-record/introduction',
      children: (
        <pre className="text-xs">
          <table className="w-full">
            <thead className="dark:text-polar-200">
              <tr>
                <th className="text-left font-normal">Tax</th>{' '}
                <th className="text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody className="dark:text-polar-500">
              <tr>
                <td>VAT</td>
                <td className="text-right">€2,450.00</td>
              </tr>
              <tr>
                <td>GST</td>
                <td className="text-right">£1,230.00</td>
              </tr>
              <tr>
                <td>Sales Tax</td>
                <td className="text-right">$3,120.00</td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <hr className="border-polar-600 my-1" />
                </td>
              </tr>
              <tr>
                <td>Status</td>
                <td className="text-polar-50 text-right">Submitted</td>
              </tr>
            </tbody>
          </table>
        </pre>
      ),
    },
  ]

  return (
    <section className={className}>
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-8">
        {features.map((feature, index) => (
          <FeatureCard
            key={index}
            title={feature.title}
            description={feature.description}
            linkHref={feature.linkHref}
          >
            {feature.children}
          </FeatureCard>
        ))}
        <Console
          title="nvim"
          className="col-span-2"
          code={`import { Checkout } from '@polar-sh/nextjs'
  
export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN
})
  `}
        />
      </div>
    </section>
  )
}

export default Features
