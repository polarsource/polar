'use client'

import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { DiscordIcon } from '@/components/Benefit/utils'
import GitHubIcon from '@/components/Icons/GitHubIcon'
import { AnimatedSeparator } from '@/components/Landing/AnimatedSeparator'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import {
  ApiOutlined,
  AttachMoneyOutlined,
  Bolt,
  BoltOutlined,
  FaceOutlined,
  FavoriteBorderOutlined,
  HowToVoteOutlined,
  PercentOutlined,
  SyncAltOutlined,
  TextSnippet,
  TextSnippetOutlined,
} from '@mui/icons-material'
import { SubscriptionTier, UserSignupType } from '@polar-sh/sdk'
import { motion, useScroll, useTransform } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import { ComponentProps, PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

const Box = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex flex-row bg-white">
      <AnimatedSeparator
        className="hidden md:block"
        orientation="vertical"
        whileInView={false}
      />
      <div className="flex flex-grow flex-col">
        <AnimatedSeparator />
        {children}
        <AnimatedSeparator className="hidden md:block" />
      </div>
      <AnimatedSeparator
        className="hidden md:block"
        orientation="vertical"
        whileInView={false}
      />
    </div>
  )
}

export default function Page() {
  return (
    <div className="flex flex-col md:gap-y-12">
      <Box>
        <HeroSection />
      </Box>
      <Box>
        <BenefitsUpsell />
      </Box>
      <Box>
        <FeaturesUpsell />
      </Box>
      <Box>
        <DevelopersUpsell />
      </Box>
      <Box>
        <Pricing />
      </Box>
      <Box>
        <SignUpBanner />
      </Box>
    </div>
  )
}

const BlueLink = ({ className, ...props }: ComponentProps<typeof Link>) => {
  return (
    <Link
      className={twMerge('text-blue-400 hover:text-blue-300', className)}
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
          <h1 className="text-pretty text-4xl leading-tight text-gray-950">
            Get paid coding on your passion
          </h1>
          <p className="text-xl leading-relaxed text-gray-500">
            Polar is the creator platform for developers. Offer your supporters
            & customers a subscription designed for the developer ecosystem.
          </p>
        </div>

        <div className="flex flex-col items-start gap-y-8">
          <GithubLoginButton
            size="large"
            text="Sign up with GitHub"
            userSignupType={UserSignupType.MAINTAINER}
            returnTo="/maintainer"
          />
          <p className="text-xs leading-normal text-gray-400">
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
      <div className="flex flex-col items-center justify-center bg-gray-50 p-12 md:w-3/5">
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
      <div className="flex flex-col gap-y-12 pr-6 md:w-1/2 md:pr-24">
        <div className="flex flex-col gap-y-8">
          <h1 className="text-pretty text-4xl  leading-tight text-gray-950">
            Powerful & built-in subscription benefits
          </h1>
          <p className="text-xl leading-relaxed text-gray-500">
            Polar is built open source & in public.
            <br />
            We&apos;re just getting started.
          </p>
        </div>
        <div className="flex flex-col gap-y-8">
          <ul className="flex flex-col gap-y-4">
            <li className="flex flex-row gap-x-4">
              <TextSnippet className="text-blue-500" />
              <div className="flex flex-col">
                <span className="font-medium text-gray-950">
                  Premium posts & newsletter
                </span>
                <p className="text-sm text-gray-500">
                  Offer your paid subscribers early sneak peaks, educational
                  content, code examples and more.
                </p>
              </div>
            </li>
            <li className="flex flex-row gap-x-4">
              <GitHubIcon width={30} height={30} className="text-blue-500" />
              <div className="flex flex-col">
                <span className="font-medium text-gray-950">
                  Access to private GitHub repositories
                </span>
                <p className="text-sm text-gray-500">
                  Enabling early access, sponsorware, self-hosted products,
                  starter kits, courses and so much more.
                </p>
              </div>
            </li>
            <li className="flex flex-row gap-x-4">
              <DiscordIcon size={30} className="text-blue-500" />
              <div className="flex flex-col">
                <span className="font-medium text-gray-950">
                  Discord invites
                </span>
                <p className="text-sm text-gray-500">
                  Setup custom roles per tier. Enabling membership channels to
                  individuals & support for businesses.
                </p>
              </div>
            </li>
            <li className="flex flex-row gap-x-4">
              <BoltOutlined className="text-blue-500" />
              <div className="flex flex-col">
                <span className="font-medium text-gray-950">
                  Sponsorship 2.0
                </span>
                <p className="text-sm text-gray-500">
                  Offer logo promotions on README, sites and posts. Polar will
                  automate it. No more manual overhead.
                </p>
              </div>
            </li>
          </ul>
        </div>
        <div className="flex flex-row items-center gap-x-4">
          <Link href="https://github.com/polarsource/polar" target="_blank">
            <Button className="bg-blue-50" size="lg" variant="secondary">
              <div className="flex flex-row items-center gap-x-3">
                <GitHubIcon width={16} />
                <span>GitHub</span>
              </div>
            </Button>
          </Link>
          <Link href="https://discord.gg/zneAsTPUt7" target="_blank">
            <Button className="bg-blue-50" size="lg" variant="secondary">
              <div className="flex flex-row items-center gap-x-3">
                <DiscordIcon />
                <span>Join our Discord</span>
              </div>
            </Button>
          </Link>
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
          'flex flex-col items-center justify-center gap-12 overflow-hidden border-gray-200 p-12 text-center',
          className,
        )}
      >
        <div className="flex w-full flex-col items-center justify-center gap-y-4">
          <Icon className="text-blue-500" fontSize="large" />
          <h3 className="text-pretty text-xl font-medium text-gray-950">
            {title}
          </h3>
          <p className="text-pretty text-gray-500">{description}</p>
        </div>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className="flex w-screen flex-col md:grid md:w-full md:grid-cols-3 md:grid-rows-3"
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
        className="col-span-1 row-span-2 gap-16 border-b md:border-b-0 md:border-r"
      >
        <div className="animate-infinite-scroll flex h-fit flex-row items-start justify-stretch gap-x-8 self-start text-left">
          {[...MOCKED_SUBSCRIPTION_TIERS, ...MOCKED_SUBSCRIPTION_TIERS].map(
            (tier) => (
              <SubscriptionTierCard
                key={tier.id}
                className="h-full w-[280px] border-none ring-1 ring-gray-100"
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
        className="col-span-2 md:px-32"
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
        className="col-start-3 col-end-4 border-t md:border-l"
      />
      <Feature
        icon={HowToVoteOutlined}
        title="Get a funded backlog"
        description="Built for open source maintainers, not bounty hunters. Empower your community to pool funding toward issues."
        className="col-start-1 col-end-2 border-t md:border-r"
      >
        <Image
          src="/assets/landing/fund.png"
          alt="Polar Funding Badge"
          width={800}
          height={640}
        />
      </Feature>
      <Feature
        icon={FavoriteBorderOutlined}
        title="Reward contributors"
        description="Share issue funding with contributors easily."
        className="col-span-2 border-t"
      >
        <Image
          className="h-fit w-96 rounded-xl object-contain shadow-md"
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
  const { scrollYProgress } = useScroll()
  const leftListY = useTransform(scrollYProgress, [0, 1], ['0%', '-25%'])
  const rightListY = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])

  const DeveloperCard = ({
    avatarUrl,
    name,
    description,
    href,
  }: {
    avatarUrl: string
    name: string
    description: string
    href: string
  }) => {
    return (
      <Link
        href={href}
        className="bg-gray-75 flex flex-col items-center gap-y-6 p-8"
      >
        <Avatar className="h-16 w-16" avatar_url={avatarUrl} name={name} />
        <div className="flex flex-col items-center gap-y-2 text-center">
          <h3 className="font-medium text-gray-950">{name}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </Link>
    )
  }

  return (
    <motion.div
      className="flex flex-1 flex-col md:flex-row md:items-center"
      initial="initial"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <div className="flex h-full max-h-[400px] flex-row items-center justify-center gap-6 overflow-hidden px-6 md:max-h-[540px] md:w-1/2">
        <motion.div className="flex flex-col gap-y-6" style={{ y: leftListY }}>
          <DeveloperCard
            name="Tuist"
            description="Supercharge your Xcode development workflows"
            avatarUrl="https://avatars.githubusercontent.com/u/38419084?v=4"
            href="/tuist"
          />
          <DeveloperCard
            name="Emil Widlund"
            description="Creative Technologist. Writing about creative coding adventures."
            avatarUrl="https://avatars.githubusercontent.com/u/10053249?v=4"
            href="/emilwidlund"
          />
          <DeveloperCard
            name="Iconoir"
            description="An open source icons library with 1500+ icons, supporting React, React Native, Flutter, Vue, Figma, and Framer."
            avatarUrl="https://avatars.githubusercontent.com/u/109069170?v=4"
            href="/iconoir-icons"
          />
          <DeveloperCard
            name="TRPC"
            description="Move Fast and Break Nothing"
            avatarUrl="https://avatars.githubusercontent.com/u/78011399?v=4"
            href="/trpc"
          />
          <DeveloperCard
            name="Strawberry GraphQL"
            description="A Python library for creating GraphQL APIs"
            avatarUrl="https://avatars.githubusercontent.com/u/48071860?v=4"
            href="/strawberry-graphql"
          />
        </motion.div>
        <motion.div className="flex flex-col gap-y-6" style={{ y: rightListY }}>
          <DeveloperCard
            name="Your Next Store"
            description="YourNextStore (YNS) is a modern storefront boilerplate built with Next.js App Router using modern practices."
            avatarUrl="https://avatars.githubusercontent.com/u/159799280?v=4"
            href="/yournextstore"
          />
          <DeveloperCard
            name="SerenityOS"
            description="The Serenity Operating System"
            avatarUrl="https://avatars.githubusercontent.com/u/50811782?v=4"
            href="/SerenityOS"
          />
          <DeveloperCard
            name="David Hewitt"
            description="Uniting Python & Rust. Core maintainer of PyO3. Full-stack developer; other than Rust you'll find me using Python and Typescript."
            avatarUrl="https://avatars.githubusercontent.com/u/1939362?v=4"
            href="/davidhewitt"
          />
          <DeveloperCard
            name="Yagiz Nizipli"
            description="@nodejs technical steering committee, @openjs-foundation member"
            avatarUrl="https://avatars.githubusercontent.com/u/1935246?v=4"
            href="/anonrig"
          />
          <DeveloperCard
            name="Isaac Harris-Holt"
            description="Founding Engineer @ Pluto. Technology journalist and content creator. Avid Pythonista and hopefully future billionaire."
            avatarUrl="https://avatars.githubusercontent.com/u/47423046?v=4"
            href="/isaacharrisholt"
          />
        </motion.div>
      </div>
      <AnimatedSeparator className="md:hidden" orientation="horizontal" />
      <div className="flex flex-col gap-y-12 px-6 py-16 md:w-1/2 md:px-16">
        <div className="flex flex-col gap-y-8">
          <h1 className="text-pretty text-4xl  leading-tight text-gray-950">
            Serving world-class developers
          </h1>
          <p className="text-xl leading-relaxed text-gray-500">
            We&apos;re proud to support incredible developers and open source
            initiatives that are shaping the future.
          </p>
          <p className="text-xl leading-relaxed text-gray-500">
            Join us today.
          </p>
        </div>
      </div>
    </motion.div>
  )
}

const Pricing = () => {
  const PriceCard = ({
    children,
    title,
    description,
  }: PropsWithChildren<{
    title: string
    description: string
  }>) => {
    return (
      <div className="flex w-full flex-1 flex-col gap-8 px-8 py-12 md:px-12 md:py-24">
        <span className="text-blue-500">{children}</span>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl leading-snug">{title}</h1>
          <p className="text-lg text-gray-500">{description}</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="flex flex-col"
      initial="initial"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <h1 className="px-6 py-24 text-4xl text-gray-950 md:px-16 md:text-center">
        Pricing
      </h1>

      <AnimatedSeparator />
      <div className="flex flex-col md:flex-row md:px-12">
        <PriceCard
          title="Zero Fixed Costs"
          description="No hidden or monthly costs."
        >
          <FavoriteBorderOutlined fontSize="large" />
        </PriceCard>
        <AnimatedSeparator className="hidden md:block" orientation="vertical" />
        <AnimatedSeparator className="md:hidden" orientation="horizontal" />
        <PriceCard
          title="5% Revenue Share"
          description="
We're in this together. We earn when you do."
        >
          <PercentOutlined fontSize="large" />
        </PriceCard>
        <AnimatedSeparator className="hidden md:block" orientation="vertical" />
        <AnimatedSeparator className="md:hidden" orientation="horizontal" />
        <PriceCard
          title="Stripe Fees"
          description="Stripe transaction- and payout fees apply before transfers."
        >
          <SyncAltOutlined fontSize="large" />
        </PriceCard>
      </div>
    </motion.div>
  )
}

const SignUpBanner = () => {
  return (
    <motion.div
      className="flex flex-col items-center gap-12 px-12 py-24"
      initial="initial"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <h1 className="text-center text-4xl leading-snug text-gray-950">
        We&apos;ve run out of sales pitches
      </h1>

      <GithubLoginButton
        size="large"
        text="Sign up with GitHub"
        userSignupType={UserSignupType.MAINTAINER}
        returnTo="/maintainer"
      />
    </motion.div>
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
        description: 'Weekly Newsletter',
        type: 'articles',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
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
        price_amount: 1900,
        price_currency: 'usd',
        recurring_interval: 'month',
        is_archived: false,
      },
    ],
    benefits: [
      {
        id: '123',
        description: 'Premium Newsletter',
        type: 'articles',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '456',
        description: 'Bug Report Priority',
        type: 'custom',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
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
        description: 'Premium Newsletter',
        type: 'articles',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '456',
        description: 'Your logotype in Newsletter',
        type: 'articles',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '789',
        description: '4 hours of consulting',
        type: 'custom',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
    ],
  },
]
