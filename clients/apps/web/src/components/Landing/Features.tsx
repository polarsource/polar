'use client'

import {
  Check,
  DonutLargeOutlined,
  DownloadingOutlined,
  Face,
  HiveOutlined,
  KeyOutlined,
  LanguageOutlined,
  ShieldOutlined,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { DiscordIcon } from '../Benefit/utils'
import GitHubIcon from '../Icons/GitHubIcon'

type FeatureCardProps = {
  icon: React.ReactNode
  title: string
  description: string
  linkHref: string
  className?: string
  children?: React.ReactNode
}

const FeatureCard = ({
  icon,
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
        target="_blank"
        className="dark:border-polar-700 dark:bg-polar-900 flex flex-col justify-between gap-y-8 rounded-2xl border border-gray-200 bg-white p-8 transition-transform hover:translate-y-[-4px] md:h-96"
      >
        <div className="flex flex-col gap-y-6">
          {icon}
          <div className="flex flex-col gap-y-2">
            <h3 className="text-xl text-black dark:text-white">{title}</h3>
            <p className="dark:text-polar-500 w-full flex-grow text-gray-500 md:max-w-96">
              {description}
            </p>
          </div>
        </div>
        {children}
      </Link>
    </motion.div>
  )
}

const CustomerCard = () => {
  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 flex items-center gap-x-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
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
      icon: <HiveOutlined fontSize="large" />,
      title: 'Digital Products & SaaS Billing',
      description:
        'Create digital products and SaaS billing with flexible pricing models and seamless payment processing.',
      linkHref: 'https://docs.polar.sh/features/products',
      children: (
        <ul className="flex flex-col gap-y-1">
          <li className="flex flex-row items-center gap-x-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <p className="text-pretty leading-relaxed">Subscription Products</p>
          </li>
          <li className="flex flex-row items-center gap-x-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <p className="text-pretty leading-relaxed">One-time Purchases</p>
          </li>
          <li className="flex flex-row items-center gap-x-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <p className="text-pretty leading-relaxed">
              Usage-based billing for metered products
            </p>
          </li>
        </ul>
      ),
    },
    {
      icon: <ShieldOutlined fontSize="large" />,
      title: 'Benefits Engine',
      description:
        'Powerful entitlements engine that automates access to various features.',
      linkHref: 'https://docs.polar.sh/features/benefits',
      children: (
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              icon: <KeyOutlined className="h-5 w-5" />,
              text: 'License Keys',
            },
            {
              icon: <DownloadingOutlined className="h-5 w-5" />,
              text: 'Downloadables',
            },
            { icon: <GitHubIcon className="h-5 w-5" />, text: 'GitHub Repos' },
            {
              icon: <DiscordIcon className="h-5 w-5" />,
              text: 'Discord Roles',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="dark:bg-polar-800 dark:border-polar-700 flex items-center gap-x-2 rounded-lg border border-gray-200 bg-gray-100 p-3"
            >
              {item.icon}
              <span className="dark:text-polar-500 text-sm text-gray-500">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: <Face fontSize="large" />,
      title: 'Customer Management',
      description:
        'Streamlined customer lifecycle management with detailed profiles and analytics.',
      linkHref: 'https://docs.polar.sh/features/customer-management',
      children: (
        <div className="relative h-[120px] md:h-[200px]">
          <div className="absolute left-0 right-0 top-0 scale-90 transition-transform hover:-translate-y-1">
            <CustomerCard />
          </div>
          <div className="absolute left-0 right-0 top-4 scale-95 transition-transform hover:-translate-y-1">
            <CustomerCard />
          </div>
          <div className="absolute left-0 right-0 top-8 transition-transform hover:-translate-y-1">
            <CustomerCard />
          </div>
        </div>
      ),
    },
    {
      icon: <DonutLargeOutlined fontSize="large" />,
      title: 'Usage Based Billing (Alpha)',
      description:
        'Robust event ingestion API that enables precise usage-based billing.',
      linkHref: 'https://github.com/polarsource/polar-ingestion',
      children: (
        <div className="dark:bg-polar-800 dark:border-polar-700 flex items-center gap-x-4 overflow-auto rounded-lg border border-gray-200 bg-gray-100 p-4">
          <pre className="font-mono text-xs">
            {`Ingestion()
.strategy(new LLM(openai('gpt-4o')))
.ingest('openai-usage')`}
          </pre>
        </div>
      ),
    },
    {
      icon: <LanguageOutlined fontSize="large" />,
      title: 'Global Merchant of Record',
      description:
        'Focus on your passion while we handle all the tax compliance.',
      linkHref: 'https://docs.polar.sh/merchant-of-record/introduction',
      children: (
        <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-2 rounded-lg border border-gray-200 bg-gray-100 p-4">
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
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {features.map((feature, index) => (
          <FeatureCard
            className={index === 0 ? 'md:col-span-2' : ''}
            key={index}
            icon={feature.icon}
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
