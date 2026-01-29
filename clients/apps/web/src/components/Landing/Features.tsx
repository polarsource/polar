'use client'

import Image from 'next/image'
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
    <div
      className={twMerge('flex flex-col gap-y-6', className)}
    >
      <Link
        href={linkHref}
        target={linkHref.startsWith('http') ? '_blank' : undefined}
        className="dark:bg-polar-950 bg-white flex h-full flex-col justify-between gap-x-6 gap-y-6 p-10! hover:bg-gray-50 dark:hover:bg-polar-900 md:p-10 xl:gap-y-0 transition-colors"
      >
        <div className="flex h-full flex-col gap-y-6">
          <div className="flex h-full flex-col gap-y-2 md:gap-y-6">
            <h3 className="text-xl text-pretty text-black md:text-3xl md:leading-tight! dark:text-white">
              {title}
            </h3>
            {typeof description === 'string' ? (
              <p className="dark:text-polar-500 w-full grow text-gray-500 md:max-w-96">
                {description}
              </p>
            ) : (
              description
            )}
          </div>
        </div>
        {children}
      </Link>
    </div>
  )
}

const CustomerCard = () => {
  return (
    <div className="dark:bg-polar-900 dark:border-polar-800 flex items-center gap-x-4 border border-gray-100 bg-gray-50 p-4">
      <div className="h-12 w-12 overflow-hidden rounded-full">
        <Image
          src="/assets/landing/testamonials/emil.jpg"
          alt="Customer avatar"
          className="h-full w-full object-cover"
          width={48}
          height={48}
        />
      </div>
      <div className="flex flex-col">
        <span className="font-medium text-black dark:text-white">John Doe</span>

        <span className="dark:text-polar-500 flex flex-row gap-x-2 text-sm text-gray-500">
          <span>Premium Plan</span>
          <span>•</span>
          <span>Monthly</span>
        </span>
      </div>
    </div>
  )
}

type FeaturesProps = {
  className?: string
}

const Features = ({ className }: FeaturesProps) => {
  const features = [
    {
      title: 'Payments & Subscription Billing',
      description:
        'Create digital products and SaaS billing with flexible pricing models and seamless payment processing.',
      linkHref: 'https://polar.sh/docs/features/products',
      children: (
        <div className="grid grid-cols-2 gap-2">


        </div>
      ),
    },
    {
      title: 'Usage Billing',
      description:
        'Create digital products and SaaS billing with flexible pricing models and seamless payment processing.',
      linkHref: 'https://polar.sh/docs/features/products',
      children: (
        <div className="grid grid-cols-2 gap-2">

        </div>
      ),
    },
    {
      title: 'Customer Management',
      description:
        'Streamlined customer lifecycle management with detailed profiles and analytics.',
      linkHref: '/features/customers',
      children: (
        <div className="relative h-[120px] md:h-[200px]">

        </div>
      ),
    },
    {
      title: 'Customer Management',
      description:
        'Streamlined customer lifecycle management with detailed profiles and analytics.',
      linkHref: '/features/customers',
      children: (
        <div className="relative h-[120px] md:h-[200px]">

        </div>
      ),
    },
    {
      title: 'Customer Management',
      description:
        'Streamlined customer lifecycle management with detailed profiles and analytics.',
      linkHref: '/features/customers',
      children: (
        <div className="relative h-[120px] md:h-[200px]">

        </div>
      ),
    },
    {
      title: 'Global Merchant of Record',
      description:
        'Focus on your passion while we handle all headaches & tax compliance.',
      linkHref: '/resources/merchant-of-record',
      children: (
        <div>
        </div>
      ),
    },
  ]

  return (
    <section className={className}>
      <div
        className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-px p-px bg-gray-200 dark:bg-polar-800"
      >
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
