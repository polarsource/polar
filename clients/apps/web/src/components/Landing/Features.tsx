'use client'

import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import AnimatedBars from './animated/AnimatedBars'
import AnimatedCircles from './animated/AnimatedCircles'
import AnimatedLines from './animated/AnimatedLines'
import AnimatedSquares from './animated/AnimatedSquares'
import AnimatedWaves from './animated/AnimatedWaves'
import Vestaboard from './animated/Vestaboard'

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
      className={twMerge('flex flex-col', className)}
    >
      <Link
        href={linkHref}
        target={linkHref.startsWith('http') ? '_blank' : undefined}
        className="dark:bg-polar-950 bg-white flex h-full flex-col gap-y-4 hover:bg-gray-50 dark:hover:bg-polar-900 transition-colors overflow-hidden"
      >
        <div className="flex h-full flex-col gap-y-2 md:gap-y-6 p-6 md:p-10">
          <h3 className="text-xl text-pretty text-black md:text-3xl md:leading-tight! dark:text-white">
            {title}
          </h3>
          {typeof description === 'string' ? (
            <p className="dark:text-polar-500 w-full grow text-gray-500 md:max-w-96 text-xl">
              {description}
            </p>
          ) : (
            description
          )}
        </div>
        <div className="w-full">
          {children}
        </div>
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
      title: 'Payments & Subscription Billing',
      description:
        'Create digital products with flexible pricing models.',
      linkHref: 'https://polar.sh/docs/features/products',
      children: (
        <div className="relative h-[180px]">
          <Vestaboard height={180} cellSize={24} fontSize={10} waveScale={3} waveSpeed={0.6} characters='.:-+/\#' />
        </div>
      ),
    },
    {
      title: 'Usage Billing for the AI era',
      description:
        'Charge your customers for AI usage with precision.',
      linkHref: 'https://polar.sh/docs/features/products',
      children: (
        <div className="relative h-[180px]">
         <Vestaboard height={180} cellSize={24} fontSize={10} waveScale={3} waveSpeed={0.6} characters='.:-+/\#' />
        </div>
      ),
    },
    {
      title: 'Customer Management',
      description:
        'Streamlined customer management & analytics.',
      linkHref: '/features/customers',
      children: (
        <div className="relative h-[180px]">
          <Vestaboard height={180} cellSize={24} fontSize={10} waveScale={3} waveSpeed={0.6} characters='.:-+/\#' />
        </div>
      ),
    },
    {
      title: 'Self-serving Customer Portal',
      description:
        'Streamlined customer lifecycle management with detailed profiles and analytics.',
      linkHref: '/features/customers',
      children: (
        <div className="relative h-[180px]">
         <Vestaboard height={180} cellSize={24} fontSize={10} waveScale={3} waveSpeed={0.6} characters='.:-+/\#' />
        </div>
      ),
    },
    {
      title: 'Robust, secure & optimized checkouts',
      description:
        'Streamlined customer lifecycle management with detailed profiles and analytics.',
      linkHref: '/features/customers',
      children: (
        <div className="relative h-[180px]">
          <AnimatedWaves />
        </div>
      ),
    },
    {
      title: 'Global Merchant of Record',
      description:
        'Focus on your passion while we handle all headaches & tax compliance.',
      linkHref: '/resources/merchant-of-record',
      children: (
        <div className="relative h-[180px]">
          <AnimatedLines />
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
