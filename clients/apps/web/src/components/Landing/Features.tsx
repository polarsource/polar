'use client'

import {
  AllInclusiveOutlined,
  Check,
  DonutLargeOutlined,
  DownloadingOutlined,
  Face,
  HiveOutlined,
  KeyOutlined,
  LanguageOutlined,
  ShortTextOutlined,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { CircleGauge } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { DiscordIcon } from '../Benefit/utils'
import GitHubIcon from '../Icons/GitHubIcon'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'

type FeatureCardProps = {
  icon: React.ReactNode
  title: string
  description: string
  linkHref: string
  className?: string
  children?: React.ReactNode
  wide?: boolean
}

const FeatureCard = ({
  icon,
  title,
  description,
  linkHref,
  className,
  children,
  wide,
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
        className={twMerge(
          'dark:border-polar-700 dark:bg-polar-900 flex h-full gap-x-6 gap-y-8 rounded-2xl border border-transparent bg-white p-8 transition-transform hover:translate-y-[-4px]',
          wide
            ? 'flex-col justify-between xl:flex-row xl:justify-start'
            : 'flex-col justify-between',
        )}
      >
        <div className="flex flex-col gap-y-6">
          <span>{icon}</span>
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
      icon: <DonutLargeOutlined fontSize="medium" />,
      title: 'Usage Based Billing',
      description:
        'Robust Event Ingestion API that enables precise usage-based billing with the use of Ingestion Strategies.',
      linkHref:
        'https://docs.polar.sh/features/usage-based-billing/introduction',
      children: (
        <div className="flex flex-1 flex-col gap-y-2">
          <div className="dark:bg-polar-800 dark:border-polar-700 flex items-center gap-x-4 overflow-auto rounded-lg border border-gray-200 bg-gray-100 p-4 font-mono text-xs">
            <SyntaxHighlighterProvider>
              <SyntaxHighlighterClient
                lang="typescript"
                code={`const llmIngestion = Ingestion()
  .strategy(new LLM(openai('gpt-4o')))
  .ingest('openai-usage')
  
const model = llmIngestion.client({
  externalCustomerId: "john_doe_123"
});

const { text } = await streamText({
  model,
  prompt,
  system: "You are a helpful assistant"
});`}
              />
            </SyntaxHighlighterProvider>
          </div>
          <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-x-4 gap-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
            <div className="flex flex-row items-center gap-x-2">
              <div className="h-6 w-6 overflow-hidden rounded-full">
                <Image
                  src="/assets/landing/testamonials/emil.jpg"
                  alt="Customer avatar"
                  className="h-full w-full object-cover"
                  width={48}
                  height={48}
                />
              </div>
              <span className="text-sm font-medium text-black dark:text-white">
                John Doe
              </span>
            </div>
            <div className="flex flex-col">
              <span className="dark:text-polar-500 flex flex-row justify-between gap-x-2 text-sm text-gray-500">
                <span>63,529 Prompt Tokens</span>
                <span>$57.63</span>
              </span>
              <span className="dark:text-polar-500 flex flex-row justify-between gap-x-2 text-sm text-gray-500">
                <span>75,348 Completion Tokens</span>
                <span>$75.12</span>
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: <HiveOutlined fontSize="medium" />,
      title: 'Digital Products & SaaS Billing',
      description:
        'Create digital products and SaaS billing with flexible pricing models and seamless payment processing.',
      linkHref: 'https://docs.polar.sh/features/products',
      children: (
        <ul className="flex flex-col gap-y-1">
          <li className="flex flex-row items-center gap-x-2">
            <Check className="text-emerald-500" fontSize="small" />
            <p className="text-pretty leading-relaxed">
              Digital & Subscription Products
            </p>
          </li>
          <li className="flex flex-row items-center gap-x-2">
            <Check className="text-emerald-500" fontSize="small" />
            <p className="text-pretty leading-relaxed">
              Multiple Pricing Models
            </p>
          </li>
          <li className="flex flex-row items-center gap-x-2">
            <Check className="text-emerald-500" fontSize="small" />
            <p className="text-pretty leading-relaxed">
              Discounts, Checkout Links & Benefits
            </p>
          </li>
        </ul>
      ),
    },
    {
      icon: <AllInclusiveOutlined fontSize="medium" />,
      title: 'Benefits Engine',
      description:
        'Powerful entitlements engine that automates access to various features.',
      linkHref: 'https://docs.polar.sh/features/benefits',
      children: (
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              icon: <KeyOutlined className="h-4 w-4" fontSize="small" />,
              text: 'License Keys',
            },
            {
              icon: <CircleGauge className="h-4 w-4" />,
              text: 'Credits',
            },
            {
              icon: (
                <DownloadingOutlined className="h-4 w-4" fontSize="small" />
              ),
              text: 'Downloadables',
            },
            { icon: <GitHubIcon className="h-4 w-4" />, text: 'GitHub Repos' },
            {
              icon: <DiscordIcon className="h-4 w-4" />,
              text: 'Discord Roles',
            },
            {
              icon: <ShortTextOutlined className="h-4 w-4" fontSize="small" />,
              text: 'Custom',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="dark:bg-polar-800 dark:border-polar-700 flex items-center gap-x-2 rounded-lg border border-gray-200 bg-gray-100 px-3 py-2"
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
      icon: <Face fontSize="medium" />,
      title: 'Customer Management',
      description:
        'Streamlined customer lifecycle management with detailed profiles and analytics.',
      linkHref: 'https://docs.polar.sh/features/customer-management',
      children: (
        <div className="relative h-[120px] md:h-[200px]">
          <div className="absolute bottom-8 left-0 right-0 scale-90 transition-transform hover:-translate-y-1">
            <CustomerCard />
          </div>
          <div className="absolute bottom-4 left-0 right-0 scale-95 transition-transform hover:-translate-y-1">
            <CustomerCard />
          </div>
          <div className="absolute bottom-0 left-0 right-0 transition-transform hover:-translate-y-1">
            <CustomerCard />
          </div>
        </div>
      ),
    },
    {
      icon: <LanguageOutlined fontSize="medium" />,
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
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {features.map((feature, index) => (
          <FeatureCard
            className={index === 0 ? 'xl:col-span-2' : ''}
            key={index}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
            linkHref={feature.linkHref}
            wide={index === 0}
          >
            {feature.children}
          </FeatureCard>
        ))}
      </motion.div>
    </section>
  )
}

export default Features
