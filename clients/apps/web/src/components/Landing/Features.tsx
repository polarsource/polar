'use client'

import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'

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
    <div className={twMerge('group flex flex-col', className)}>
      <Link
        href={linkHref}
        target={linkHref.startsWith('http') ? '_blank' : undefined}
        className="dark:bg-polar-900 flex h-full flex-col rounded-3xl bg-gray-50"
      >
        <div className="flex h-full flex-col gap-y-2 p-6 md:gap-y-6 md:p-10">
          <h3 className="text-xl text-pretty text-black md:text-3xl md:leading-tight! dark:text-white">
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
        <div className="w-full">{children}</div>
      </Link>
    </div>
  )
}

type FeaturesProps = {
  className?: string
}

const Features = ({ className }: FeaturesProps) => {
  const features = [
    {
      title: 'Usage Billing for the AI era',
      description: 'Charge your customers for AI usage with precision.',
      linkHref: 'https://polar.sh/docs/features/products',
    },
    {
      title: 'Subscriptions & Digital Products',
      description: 'Create digital products with flexible pricing models.',
      linkHref: 'https://polar.sh/docs/features/products',
    },
    {
      title: 'Global Merchant of Record',
      description: 'Focus on your passion while we pay your VAT & sales tax.',
      linkHref: '/resources/merchant-of-record',
    },
  ]

  return (
    <section className={className}>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
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
      </div>
    </section>
  )
}

export default Features
