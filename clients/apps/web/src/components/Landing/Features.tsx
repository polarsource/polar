import {
  DonutLargeOutlined,
  Face,
  HiveOutlined,
  LanguageOutlined,
  ShieldOutlined,
  ShoppingBagOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import GitHubIcon from '../Icons/GitHubIcon'

type FeatureCardProps = {
  icon: React.ReactNode
  title: string
  description: string
  linkHref: string
  className?: string
}

const FeatureCard = ({
  icon,
  title,
  description,
  linkHref,
  className,
}: FeatureCardProps) => {
  return (
    <Link
      href={linkHref}
      className={twMerge(
        'border-polar-700 bg-polar-900 flex h-96 flex-col gap-y-6 rounded-2xl border p-6 shadow-lg transition-transform hover:translate-y-[-4px]',
        className,
      )}
    >
      {icon}
      <h3 className="text-xl text-white">{title}</h3>
      <p className="dark:text-polar-500 flex-grow">{description}</p>
    </Link>
  )
}

type FeaturesProps = {
  className?: string
}

const Features = ({ className }: FeaturesProps) => {
  const features = [
    {
      icon: <HiveOutlined fontSize="small" />,
      title: 'Digital Products & SaaS Billing',
      description:
        'Comprehensive billing solutions for digital products and subscription-based services with flexible pricing models and seamless payment processing.',
      linkHref: '#billing',
    },
    {
      icon: <ShieldOutlined fontSize="small" />,
      title: 'Benefits Engine',
      description:
        'Powerful entitlements engine on steroids that automates access management to various features based on subscription plans and custom rules.',
      linkHref: '#benefits',
    },
    {
      icon: <Face fontSize="small" />,
      title: 'Customer Management',
      description:
        'Streamlined customer lifecycle management with detailed profiles, segmentation, and analytics to drive better business decisions.',
      linkHref: '#customers',
    },
    {
      icon: <DonutLargeOutlined fontSize="small" />,
      title: 'Usage Based Billing',
      description:
        'Robust event ingestion API that enables precise usage-based billing, allowing you to charge customers based on their actual consumption.',
      linkHref: '#usage-billing',
    },
    {
      icon: <LanguageOutlined fontSize="small" />,
      title: 'Global Merchant of Record',
      description:
        'Simplified global commerce with built-in tax compliance, currency conversion, and payment methods tailored to local markets.',
      linkHref: '#global',
    },
    {
      icon: <GitHubIcon width={24} height={24} />,
      title: 'Open Source',
      description:
        'Transparent, community-driven development ensures you always have access to the source code and can contribute to improving the platform.',
      linkHref: 'https://github.com/polarsource',
    },
    {
      icon: <ShoppingBagOutlined fontSize="small" />,
      title: 'Payment Processing',
      description:
        'Seamless payment processing with built-in support for credit cards, PayPal, and more.',
      linkHref: '#payment-processing',
    },
  ]

  return (
    <section className={className}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, index) => (
          <FeatureCard
            className={index === 0 ? 'col-span-2' : ''}
            key={index}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
            linkHref={feature.linkHref}
          />
        ))}
      </div>
    </section>
  )
}

export default Features
