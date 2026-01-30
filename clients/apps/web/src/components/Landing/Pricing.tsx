'use client'

import CheckOutlined from '@mui/icons-material/CheckOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import AnimatedGradient from './animated/AnimatedGradient'
import Vestaboard from './animated/Vestaboard'

type PricingTier = {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  ctaHref: string
  highlighted?: boolean
}

const tiers: PricingTier[] = [
  {
    name: 'Indie',
    price: 'Free',
    period: '',
    description: 'Perfect for side projects and experimentation.',
    features: [
      '4% + 40¢ per transaction',
      'Merchant of Record',
      'Unlimited Products',
      'Basic Analytics',
      'Community Support',
    ],
    cta: 'Get Started',
    ctaHref: '/signup',
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For growing projects & businesses ready to scale.',
    features: [
      '3.5% + 35¢ per transaction',
      'Merchant of Record',
      'Members & Role-based Access',
      'Advanced Analytics',
      'Priority Support',
    ],
    cta: 'Upgrade Now',
    ctaHref: '/signup',
    highlighted: true,
  },
  {
    name: 'Startup',
    price: '$299',
    period: '/month',
    description: 'For teams that need collaboration features.',
    features: [
      '3.2% + 30¢ per transaction',
      'Everything in Pro',
      'Elevated Rate Limiting',
      'Dedicated Slack Channel',
      'Unlimited Events'
    ],
    cta: 'Upgrade Now',
    ctaHref: '/contact',
  },
]

type PricingCardProps = {
  tier: PricingTier
  className?: string
}

const PricingCard = ({ tier, className }: PricingCardProps) => {
  return (
    <div
      className={twMerge(
        'relative flex flex-col gap-y-6 p-6 md:p-10 overflow-hidden',
        'dark:bg-polar-950 bg-white',
        className
      )}
    >
      <div className="relative z-10 flex flex-col gap-y-2">
        <div className="flex items-center gap-x-2">
          <h3 className="text-xl font-medium text-black dark:text-white">
            {tier.name}
          </h3>
          {tier.highlighted && (
            <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
              Popular
            </span>
          )}
        </div>
        <p className="text-gray-500 dark:text-polar-500">{tier.description}</p>
      </div>
      <div className="relative z-10 flex items-baseline gap-x-1">
        <span className="text-4xl font-medium text-black dark:text-white">
          {tier.price}
        </span>
        {tier.period && (
          <span className="text-gray-500 dark:text-polar-500">{tier.period}</span>
        )}
      </div>
      <ul className="relative z-10 flex flex-col gap-y-3">
        {tier.features.map((feature, index) => (
          <li key={index} className="flex items-center gap-x-2">
            <CheckOutlined className="text-blue-500" fontSize="small" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="relative z-10 mt-auto pt-4">
        <Link href={tier.ctaHref}>
          <Button
            className={twMerge(
              'w-full rounded-full',
            )}
            variant={tier.highlighted ? 'default' : 'secondary'}
          >
            {tier.cta}
          </Button>
        </Link>
      </div>
    </div>
  )
}

const EnterpriseCard = () => {
  return (
    <div className="relative col-span-1 flex min-h-[280px] items-center justify-center overflow-hidden bg-gray-50 p-6 dark:bg-polar-950 md:col-span-3 md:p-12">
      <div className="absolute inset-2">
        <Vestaboard characters='.:+/\=#' cellSize={24} fontSize={10} />
      </div>
      <div className="relative z-10 flex flex-row gap-x-16 w-full bg-gray-50 p-6 dark:bg-polar-950 md:p-12 justify-between">
          <div className='flex flex-col gap-y-2'>
            <h3 className="text-2xl font-medium text-black dark:text-white">
              Enterprise
            </h3>
            <p className="text-gray-500 dark:text-polar-500 text-xl">
              Custom solutions for large organizations.
            </p>
          </div>
        <Link href="/contact">
            <Button className="rounded-full">
              Contact Sales
            </Button>
          </Link>
      </div>
    </div>
  )
}

export const Pricing = () => {
  return (
    <div className="flex flex-col gap-y-12">
      <div className="flex flex-col gap-y-4">
        <h2 className="text-2xl text-black dark:text-white md:text-4xl">
          Simple, transparent pricing.
        </h2>
        <p className="text-2xl md:text-4xl text-gray-500 dark:text-polar-500">
          Start free, scale as you grow. No hidden fees.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-px bg-gray-200 p-px dark:bg-polar-800 md:grid-cols-3">
        {tiers.map((tier) => (
          <PricingCard key={tier.name} tier={tier} />
        ))}
        <EnterpriseCard />
      </div>
    </div>
  )
}

export default Pricing
