'use client'

import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import KeyboardArrowRightOutlined from '@mui/icons-material/KeyboardArrowRightOutlined'
import AnimatedLines from './animated/AnimatedLines'
import AnimatedInfinity from './animated/AnimatedInfinity'
import AnimatedWaves from './animated/AnimatedWaves'
import AnimatedBars from './animated/AnimatedBars'
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
      className={twMerge('flex group flex-col', className)}
    >
      <Link
        href={linkHref}
        target={linkHref.startsWith('http') ? '_blank' : undefined}
        className="dark:bg-polar-950 bg-white flex h-full flex-col hover:bg-gray-50 dark:hover:bg-[#0a0a0c] overflow-hidden"
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
          <div className='flex flex-row items-center gap-x-2 text-gray-500 dark:text-polar-500 dark:group-hover:text-white group-hover:text-black transition-colors'>
            <span>Learn more</span>
            <KeyboardArrowRightOutlined fontSize='small' className='opacity-0 group-hover:opacity-100 transition-opacity' />
          </div>
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
        <div className="relative h-[180px] mx-2 mb-2">
          <Vestaboard height={180} cellSize={24} fontSize={10} waveScale={3} waveSpeed={0.6} characters='-0123456789' />
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
          <AnimatedWaves />
        </div>
      ),
    },
    {
      title: 'Global Merchant of Record',
      description:
        'Focus on your passion while we pay your VAT & sales tax.',
      linkHref: '/resources/merchant-of-record',
      children: (
        <div className="relative h-[180px] mx-2 mb-2">
          <AnimatedBars />
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
