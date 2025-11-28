'use client'

import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import DiamondOutlined from '@mui/icons-material/DiamondOutlined'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import { motion } from 'framer-motion'
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
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 2 } },
      }}
      className={twMerge('flex flex-col gap-y-6', className)}
    >
      <Link
        href={linkHref}
        target={linkHref.startsWith('http') ? '_blank' : undefined}
        className="dark:bg-polar-900 flex h-full flex-col justify-between gap-x-6 gap-y-6 rounded-2xl bg-white p-6! transition-transform hover:translate-y-[-4px] md:p-10 xl:gap-y-0"
      >
        <div className="flex h-full flex-col gap-y-6">
          <div className="flex h-full flex-col gap-y-2 md:gap-y-6">
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
        </div>
        {children}
      </Link>
    </motion.div>
  )
}

const CustomerCard = () => {
  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 flex items-center gap-x-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
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
      title: 'Payments, Usage & Billing',
      description:
        'Create digital products and SaaS billing with flexible pricing models and seamless payment processing.',
      linkHref: 'https://polar.sh/docs/features/products',
      children: (
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              icon: <HiveOutlined className="h-4 w-4" fontSize="inherit" />,
              text: 'Subscriptions',
            },
            {
              icon: (
                <DonutLargeOutlined className="h-4 w-4" fontSize="inherit" />
              ),
              text: 'Usage Billing',
            },
            {
              icon: <DiamondOutlined className="h-4 w-4" fontSize="inherit" />,
              text: 'Benefits',
            },
            {
              icon: (
                <AllInclusiveOutlined className="h-4 w-4" fontSize="inherit" />
              ),
              text: 'Customer Portal',
            },
            {
              icon: <LinkOutlined className="h-4 w-4" fontSize="inherit" />,
              text: 'Checkout Links',
            },
            {
              icon: (
                <TrendingUpOutlined className="h-4 w-4" fontSize="inherit" />
              ),
              text: 'Metrics',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="dark:bg-polar-800 dark:border-polar-700 flex items-center gap-x-3 rounded-lg border border-transparent bg-gray-50 px-3 py-2"
            >
              {item.icon}
              <span className="dark:text-polar-50 text-xs text-gray-950">
                {item.text}
              </span>
            </div>
          ))}
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
          <div className="absolute right-0 bottom-8 left-0 scale-90 transition-transform hover:-translate-y-1">
            <CustomerCard />
          </div>
          <div className="absolute right-0 bottom-4 left-0 scale-95 transition-transform hover:-translate-y-1">
            <CustomerCard />
          </div>
          <div className="absolute right-0 bottom-0 left-0 transition-transform hover:-translate-y-1">
            <CustomerCard />
          </div>
        </div>
      ),
    },
    {
      title: 'Global Merchant of Record',
      description:
        'Focus on your passion while we handle all headaches & tax compliance.',
      linkHref: '/resources/merchant-of-record',
      children: (
        <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-2 rounded-lg border border-transparent bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-black dark:text-white">
              Tax Report 2025
            </span>
            <span className="text-sm text-emerald-500">Submitted</span>
          </div>
          <div className="dark:border-polar-700 flex items-center justify-between border-t border-gray-200 pt-2">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              VAT (EU)
            </span>
            <span className="dark:text-polar-500 text-sm text-gray-500">
              €2,450.00
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Sales Tax (US)
            </span>
            <span className="dark:text-polar-500 text-sm text-gray-500">
              $3,120.00
            </span>
          </div>
        </div>
      ),
    },
  ]

  return (
    <section className={className}>
      <motion.div
        initial="hidden"
        animate="visible"
        transition={{
          staggerChildren: 0.1,
        }}
        className="flex flex-col gap-4 md:gap-8 xl:flex-row"
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
      </motion.div>
    </section>
  )
}

export default Features
