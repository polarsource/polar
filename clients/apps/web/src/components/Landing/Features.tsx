'use client'

import KeyboardArrowRightOutlined from '@mui/icons-material/KeyboardArrowRightOutlined'
import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import AnimatedBars from './animated/AnimatedBars'
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
    <div className={twMerge('group flex flex-col', className)}>
      <Link
        href={linkHref}
        target={linkHref.startsWith('http') ? '_blank' : undefined}
        className="dark:bg-polar-950 flex h-full flex-col overflow-hidden bg-white hover:bg-gray-50 dark:hover:bg-[#0a0a0c]"
      >
        <div className="flex h-full flex-col gap-y-2 p-6 md:gap-y-6 md:p-10">
          <h3 className="text-xl text-pretty text-black md:text-3xl md:leading-tight! dark:text-white">
            {title}
          </h3>
          {typeof description === 'string' ? (
            <p className="dark:text-polar-500 w-full grow text-xl text-gray-500 md:max-w-96">
              {description}
            </p>
          ) : (
            description
          )}
          <div className="dark:text-polar-500 flex flex-row items-center gap-x-2 text-gray-500 transition-colors group-hover:text-black dark:group-hover:text-white">
            <span>Learn more</span>
            <KeyboardArrowRightOutlined
              fontSize="small"
              className="opacity-0 transition-opacity group-hover:opacity-100"
            />
          </div>
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
      title: 'Payments & Subscription Billing',
      description: 'Create digital products with flexible pricing models.',
      linkHref: 'https://polar.sh/docs/features/products',
      children: (
        <div className="relative mx-2 mb-2 h-[180px]">
          <Vestaboard
            height={180}
            cellSize={24}
            fontSize={10}
            waveScale={3}
            waveSpeed={0.6}
            characters="-0123456789"
          />
        </div>
      ),
    },
    {
      title: 'Usage Billing for the AI era',
      description: 'Charge your customers for AI usage with precision.',
      linkHref: 'https://polar.sh/docs/features/products',
      children: (
        <div className="relative h-[180px]">
          <AnimatedWaves />
        </div>
      ),
    },
    {
      title: 'Global Merchant of Record',
      description: 'Focus on your passion while we pay your VAT & sales tax.',
      linkHref: '/resources/merchant-of-record',
      children: (
        <div className="relative mx-2 mb-2 h-[180px]">
          <AnimatedBars />
        </div>
      ),
    },
  ]

  return (
    <section className={className}>
      <div className="dark:bg-polar-800 grid grid-cols-1 gap-px bg-gray-200 p-px xl:grid-cols-3">
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
