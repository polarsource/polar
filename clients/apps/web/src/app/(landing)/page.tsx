'use client'

import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import {
  ApiOutlined,
  AttachMoneyOutlined,
  Bolt,
  FaceOutlined,
  FavoriteBorderOutlined,
  HowToVoteOutlined,
  TextSnippetOutlined,
} from '@mui/icons-material'
import { SubscriptionTier } from '@polar-sh/sdk'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { Separator } from 'polarkit/components/ui/separator'
import { ComponentProps, PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export default function Page() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <AnimatedSeparator />
      <BenefitsUpsell />
      <AnimatedSeparator />
      <FeaturesUpsell />
      <AnimatedSeparator />
      <DevelopersUpsell />
    </div>
  )
}

export const AnimatedSeparator = ({
  className,
  orientation = 'horizontal',
  whileInView = true,
  ...props
}: ComponentProps<typeof Separator> & { whileInView?: boolean }) => {
  return (
    <motion.div
      className="min-h-0 min-w-0 flex-shrink-0 origin-top-left"
      initial="initial"
      variants={{
        initial: {
          opacity: 1,
          width: orientation === 'horizontal' ? 'unset' : '1px',
          height: orientation === 'horizontal' ? '1px' : 'unset',
          scaleX: orientation === 'horizontal' ? '0%' : '100%',
          scaleY: orientation === 'horizontal' ? '100%' : '0%',
        },
        animate: {
          opacity: 1,
          scaleX: '100%',
          scaleY: '100%',
        },
      }}
      transition={{ duration: 1.5, ease: [0.6, 0, 0.4, 1] }}
      {...(whileInView
        ? { viewport: { once: true }, whileInView: 'animate' }
        : { animate: 'animate' })}
    >
      <Separator
        className={twMerge(
          'dark:bg-polar-700 h-full w-full bg-blue-100',
          className,
        )}
        orientation={orientation}
        {...props}
      />
    </motion.div>
  )
}

const BlueLink = ({ className, ...props }: ComponentProps<typeof Link>) => {
  return (
    <Link
      className={twMerge(
        'text-blue-400 hover:text-blue-300 dark:text-blue-300 dark:hover:text-blue-200',
        className,
      )}
      {...props}
    />
  )
}

const HeroSection = () => {
  return (
    <motion.div
      className="flex w-full flex-col md:flex-row"
      initial="initial"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <motion.div
        className="flex flex-col gap-y-12 px-6 py-16 md:w-2/5 md:px-12"
        initial="initial"
        variants={{ initial: { y: 20 }, animate: { y: 0 } }}
        transition={{ duration: 1, ease: 'easeOut' }}
        whileInView="animate"
        viewport={{ once: true }}
      >
        <div className="flex flex-col gap-y-8">
          <h1 className="text-pretty text-4xl !font-semibold leading-tight text-blue-500">
            Get paid coding on your passion
          </h1>
          <p className="dark:text-polar-500 text-xl leading-relaxed text-gray-400">
            Polar is the creator platform for developers. Offer your supporters
            & customers a subscription designed for the developer ecosystem.
          </p>
        </div>

        <div className="flex flex-col items-start gap-y-8">
          <GithubLoginButton size="large" text="Sign up with GitHub" />
          <p className="dark:text-polar-500 text-xs text-gray-400">
            By using Polar you agree to our{' '}
            <BlueLink href="/legal/terms" target="_blank">
              Terms of Service
            </BlueLink>{' '}
            and{' '}
            <BlueLink href="/legal/privacy" target="_blank">
              Privacy Policy
            </BlueLink>
            .
          </p>
        </div>
      </motion.div>
      <AnimatedSeparator
        className="hidden flex-grow md:block"
        orientation="vertical"
      />
      <AnimatedSeparator
        className="flex-grow md:hidden"
        orientation="horizontal"
      />
      <div className="dark:bg-polar-900 flex flex-col items-center justify-center bg-gray-50 p-12 md:w-3/5">
        <Image
          src="/assets/landing/subscriptions_view.webp"
          alt="Polar Subscriptions Page"
          width={800}
          height={640}
        />
      </div>
    </motion.div>
  )
}

const BenefitsUpsell = () => {
  return (
    <motion.div
      className="flex flex-col gap-16 px-6 py-24 md:flex-row md:px-0"
      initial="initial"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ delay: 0.2, duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <Image
        className="rounded-3xl object-cover object-right md:w-1/2 md:rounded-none md:rounded-r-3xl"
        src="/assets/landing/new_subscription_tier_view.webp"
        alt="Polar New Subscription Tier Page"
        width={1800}
        height={1200}
      />
      <div className="flex flex-col gap-y-12 pr-12 md:w-1/2">
        <div className="flex flex-col gap-y-8">
          <h1 className="text-pretty text-4xl !font-semibold leading-tight text-blue-500">
            Powerful & built-in subscription benefits
          </h1>
          <p className="dark:text-polar-500 text-xl leading-relaxed text-gray-400">
            Polar is built open source & in public.
            <br />
            We&apos;re just getting started.
          </p>
        </div>
        <div className="flex flex-col gap-y-8">
          <ul className="flex flex-col gap-y-4">
            <li>
              <span className="font-medium">Premium posts & newsletter</span>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Offer your paid subscribers early sneak peaks, educational
                content, code examples and more.
              </p>
            </li>
            <li>
              <span className="font-medium">
                Access to private GitHub repositories
              </span>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Enabling early access, sponsorware, self-hosted products,
                starter kits, courses and so much more.
              </p>
            </li>
            <li>
              <span className="font-medium">Discord invites</span>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Setup custom roles per tier. Enabling membership channels to
                individuals & support for businesses.
              </p>
            </li>
            <li>
              <span className="font-medium">Sponsorship 2.0</span>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Offer logo promotions on README, sites and posts. Polar will
                automate it. No more manual overhead.
              </p>
            </li>
          </ul>
        </div>
        <div className="flex flex-row items-center gap-x-4">
          <Button>GitHub</Button>
          <Button>Join our Discord</Button>
        </div>
      </div>
    </motion.div>
  )
}

const FeaturesUpsell = () => {
  const Feature = ({
    icon: Icon,
    title,
    description,
    children,
    className,
  }: PropsWithChildren<{
    icon: typeof FaceOutlined
    title: string
    description: string
    className?: string
  }>) => {
    return (
      <div
        className={twMerge(
          'dark:border-polar-700 flex flex-col items-center justify-center gap-12 overflow-hidden border-blue-100 p-12 text-center',
          className,
        )}
      >
        <div className="flex w-full flex-col items-center justify-center gap-y-4">
          <Icon className="text-blue-500" fontSize="large" />
          <h3 className="text-pretty text-lg font-medium text-blue-500">
            {title}
          </h3>
          <p className="dark:text-polar-500 max-w-[90%] text-pretty text-gray-500">
            {description}
          </p>
        </div>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className="flex flex-col md:grid md:grid-cols-3 md:grid-rows-3"
      initial="initial"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <Feature
        icon={Bolt}
        title="Individual & Business Subscriptions"
        description="Separate membership perks & commercial offerings."
        className="col-span-1 row-span-2 gap-16 border-b border-r md:border-b-0"
      >
        <div className="animate-infinite-scroll flex h-fit flex-row items-start justify-stretch gap-x-8 self-start text-left">
          {[...MOCKED_SUBSCRIPTION_TIERS, ...MOCKED_SUBSCRIPTION_TIERS].map(
            (tier) => (
              <SubscriptionTierCard
                key={tier.id}
                className="h-full w-[280px]"
                variant="small"
                subscriptionTier={tier}
              >
                <Button fullWidth>Subscribe</Button>
              </SubscriptionTierCard>
            ),
          )}
        </div>
      </Feature>
      <Feature
        icon={TextSnippetOutlined}
        title="Posts & Newletter"
        description="Write posts in an editor designed for developers. Share them with everyone, paid subscribers or a mix (paywalled sections)."
        className="col-span-2 flex-row"
      />
      <Feature
        icon={ApiOutlined}
        title="API & SDK"
        description="Integrate it all on your own docs, sites or services using our API & SDK."
        className="col-start-2 col-end-3 border-t"
      />
      <Feature
        icon={AttachMoneyOutlined}
        title="Value-add taxes handled"
        description="We handle it as the merchant of record."
        className="col-start-3 col-end-4 border-l border-t"
      />
      <Feature
        icon={HowToVoteOutlined}
        title="Get a funded backlog"
        description="Built for open source maintainers, not bounty hunters. Empower your community to pool funding toward issues."
        className="col-start-1 col-end-2 border-r border-t"
      />
      <Feature
        icon={FavoriteBorderOutlined}
        title="Reward contributors"
        description="Share issue funding with contributors easily."
        className="col-span-2 border-t"
      >
        <Image
          className="h-48 w-fit rounded-xl object-contain shadow-md"
          src="/assets/landing/rewards.webp"
          alt="Polar Issue Rewards"
          width={800}
          height={640}
        />
      </Feature>
    </motion.div>
  )
}

const DevelopersUpsell = () => {
  return (
    <div className="flex flex-1 flex-row">
      <div className="flex h-[540px] w-1/2 flex-col px-12"></div>
      <AnimatedSeparator className="h-auto min-h-0" orientation="vertical" />
      <div className="flex w-1/2 flex-col gap-y-12 px-12 py-16">
        <div className="flex flex-col gap-y-8">
          <h1 className="text-pretty text-4xl !font-semibold leading-tight text-blue-500">
            Serving world-class developers
          </h1>
          <p className="dark:text-polar-500 text-xl leading-relaxed text-gray-400">
            We&apos;re proud to support incredible developers and open source
            initiatives that are shaping the future. Join us today.
          </p>
        </div>
      </div>
    </div>
  )
}

const MOCKED_SUBSCRIPTION_TIERS: Partial<SubscriptionTier>[] = [
  {
    name: 'Follower',
    type: 'free',
    description:
      'A simple way to follow my projects. This tier is free and will give you access to my weekly newsletter.',

    benefits: [
      {
        id: '123',
        description: 'Weekly Posts',
        type: 'articles',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
      },
    ],
  },
  {
    name: 'Supporter',
    type: 'individual',
    description:
      'Thanks for supporting me & my projects. As a Supporter you will get access to my weekly newsletter & bug report priority across my open source projects.',
    prices: [
      {
        id: '123',
        created_at: new Date().toDateString(),
        price_amount: 299900,
        price_currency: 'usd',
        recurring_interval: 'month',
        is_archived: false,
      },
    ],
    benefits: [
      {
        id: '123',
        description: 'Premium Posts',
        type: 'articles',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
      },
      {
        id: '456',
        description: 'Bug Report Priority',
        type: 'custom',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
      },
    ],
  },
  {
    name: 'Enterprise',
    type: 'business',
    description:
      'Your support means a lot! This business tier will give your company exposure in my weekly newsletter, and 4 hours of monthly consulting.',
    prices: [
      {
        id: '123',
        created_at: new Date().toDateString(),
        price_amount: 299900,
        price_currency: 'usd',
        recurring_interval: 'month',
        is_archived: false,
      },
    ],
    benefits: [
      {
        id: '123',
        description: 'Premium Posts',
        type: 'articles',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
      },
      {
        id: '456',
        description: 'Your logotype in Posts',
        type: 'articles',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
      },
      {
        id: '789',
        description: '4 hours of consulting',
        type: 'custom',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
      },
    ],
  },
]
