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
  StickyNote2Outlined,
  SyncAltOutlined,
  TextSnippetOutlined,
  VolunteerActivismOutlined,
} from '@mui/icons-material'
import { Product, UserSignupType } from '@polar-sh/sdk'
import { motion, useScroll, useTransform } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import { ComponentProps, PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

const Box = ({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) => {
  return (
    <div
      className={twMerge(
        'flex flex-row bg-gray-50 dark:bg-transparent',
        className,
      )}
    >
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
        <Testamonials />
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
      <SignUpBanner />
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
          <h1 className="text-pretty text-4xl leading-tight text-gray-950 dark:text-white">
            Funding & Monetization tools for Developers
          </h1>
          <p className="text-xl leading-relaxed text-gray-500">
            The all-in-one funding & monetization platform for open source- and
            indie developers. Built entirely open source.
          </p>
        </div>

        <div className="flex flex-col items-start gap-y-8">
          <GithubLoginButton
            size="large"
            text="Sign up with GitHub"
            userSignupType={UserSignupType.MAINTAINER}
            returnTo="/maintainer"
          />
          <p className="dark:text-polar-500 text-xs leading-normal text-gray-400">
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
      <div className="flex h-full w-full flex-col items-center justify-center p-12 md:w-3/5">
        <Image
          className="block dark:hidden"
          src="/assets/landing/subscriptions_view.webp"
          alt="Polar Subscriptions Page"
          width={800}
          height={640}
        />
        <Image
          className="hidden dark:block"
          src="/assets/landing/subscriptions_view_dark.png"
          alt="Polar Subscriptions Page"
          width={800}
          height={640}
        />
      </div>
    </motion.div>
  )
}

const BenefitsUpsell = () => {
  const { scrollYProgress } = useScroll()
  const listY = useTransform(scrollYProgress, [0, 1], ['0%', '-50%'])

  return (
    <motion.div
      className="flex flex-col items-start md:flex-row md:px-0"
      initial="initial"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ delay: 0.2, duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <div className="flex h-full max-h-[660px] w-full flex-row items-center justify-center gap-8 overflow-hidden border-b px-12 md:w-2/5 md:border-none">
        <motion.div className="flex flex-col gap-y-6" style={{ y: listY }}>
          {MOCKED_PRODUCTS.map((tier) => (
            <motion.div key={tier.id} className="w-[300px]">
              <SubscriptionTierCard
                className="dark:ring-polar-700 h-full border-none bg-white ring-1 ring-gray-100"
                variant="small"
                subscriptionTier={tier}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
      <div className="flex w-full flex-col gap-y-12 px-8 py-24 pr-6 md:w-3/5 md:px-20 md:pr-24">
        <div className="flex flex-col gap-y-8">
          <h1 className="text-pretty text-4xl leading-tight text-gray-950 dark:text-white">
            Powerful & automatic subscription benefits
          </h1>
          <p className="dark:text-polar-400 text-pretty text-lg text-gray-600">
            Offer subscription tiers with benefits, built for the developer
            ecosystem.
          </p>
        </div>
        <div className="flex flex-col gap-y-8">
          <ul className="flex flex-col gap-y-4">
            <li className="flex flex-row gap-x-4">
              <StickyNote2Outlined className="text-gray-950 dark:text-white" />
              <div className="flex flex-col">
                <span className="font-medium text-gray-950 dark:text-white">
                  Premium posts & newsletter
                </span>
                <p className="dark:text-polar-400 text-sm text-gray-500">
                  Offer your paid subscribers early sneak peaks & educational
                  content.
                </p>
              </div>
            </li>
            <li className="flex flex-row gap-x-4">
              <GitHubIcon
                width={25}
                height={25}
                className="text-gray-950 dark:text-white"
              />
              <div className="flex flex-col">
                <span className="font-medium text-gray-950 dark:text-white">
                  Access to private GitHub repositories
                </span>
                <p className="dark:text-polar-400 text-sm text-gray-500">
                  Enabling early access, sponsorware, courses & so much more.
                </p>
              </div>
            </li>
            <li className="flex flex-row gap-x-4">
              <DiscordIcon
                size={25}
                className="text-gray-950 dark:text-white"
              />
              <div className="flex flex-col">
                <span className="font-medium text-gray-950 dark:text-white">
                  Discord invites
                </span>
                <p className="dark:text-polar-400 text-sm text-gray-500">
                  Manage membership channels to individuals & support for
                  businesses.
                </p>
              </div>
            </li>
            <li className="flex flex-row gap-x-4">
              <BoltOutlined className="text-gray-950 dark:text-white" />
              <div className="flex flex-col">
                <span className="font-medium text-gray-950 dark:text-white">
                  Sponsorship 2.0
                </span>
                <p className="dark:text-polar-400 text-sm text-gray-500">
                  Logo promotions on README, sites & newsletters. Polar will
                  automate it.
                </p>
              </div>
            </li>
          </ul>
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
          'dark:border-polar-700 flex flex-col items-center justify-center gap-12 overflow-hidden border-gray-200 p-12 text-center',
          className,
        )}
      >
        <div className="flex w-full flex-col items-center justify-center gap-y-4">
          <Icon className="text-blue-500 dark:text-blue-400" fontSize="large" />
          <h3 className="text-pretty text-xl font-medium text-gray-950 dark:text-white">
            {title}
          </h3>
          <p className="dark:text-polar-400 text-pretty text-gray-500">
            {description}
          </p>
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
        className="col-span-2 gap-16 border-b md:border-b-0 md:border-r"
      />
      <Feature
        icon={TextSnippetOutlined}
        title="Posts & Newletter"
        description="Share newsletters with everyone, paid subscribers or a mix."
        className="col-span-1"
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
      <Feature
        icon={VolunteerActivismOutlined}
        title="Donations"
        description="Give your supporters an easy way to donate."
        className="col-span-1 border-t md:border-r"
      />
      <Feature
        icon={AttachMoneyOutlined}
        title="Value-add taxes handled"
        description="We handle it as the merchant of record."
        className="col-start-2 col-end-3 border-t"
      />
      <Feature
        icon={ApiOutlined}
        title="API & SDK"
        description="Integrate it all on your own docs, sites or services using our API & SDK."
        className="col-start-3 col-end-4 border-t md:border-l"
      />
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
        className="dark:bg-polar-900 flex flex-col items-center gap-y-6 bg-white p-8"
      >
        <Avatar className="h-16 w-16" avatar_url={avatarUrl} name={name} />
        <div className="flex flex-col items-center gap-y-2 text-center">
          <h3 className="font-medium text-gray-950 dark:text-white">{name}</h3>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            {description}
          </p>
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
          <h1 className="text-pretty text-4xl leading-tight text-gray-950 dark:text-white">
            Serving world-class developers
          </h1>
          <p className="dark:text-polar-500 text-xl leading-relaxed text-gray-500">
            We&apos;re proud to support incredible developers and open source
            initiatives that are shaping the future.
          </p>
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
        <span className="text-blue-500 dark:text-blue-400">{children}</span>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl leading-snug">{title}</h1>
          <p className="dark:text-polar-500 text-lg text-gray-500">
            {description}
          </p>
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
      <h1 className="px-6 py-24 text-4xl text-gray-950 md:px-16 md:text-center dark:text-white">
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
      <h1 className="text-center text-4xl leading-snug text-gray-950 dark:text-white">
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

const testamonials = [
  {
    link: 'https://x.com/mitchellh/status/1775925951668552005',
    name: 'Mitchell Hashimoto',
    company: 'Ghostty',
    avatar:
      'https://pbs.twimg.com/profile_images/1141762999838842880/64_Y4_XB_400x400.jpg',
    text: (
      <>
        <p>I&apos;ve joined Polar as an advisor!</p>
        <p className="dark:text-polar-200 text-gray-500">
          I think it benefits everyone for devs to have more options to get paid
          to work on their passions, to support upstreams, and for users to have
          more confidence/transparency in the software they&apos;re
          supporting/purchasing.
        </p>
      </>
    ),
  },
  {
    link: 'https://x.com/awesomekling/status/1794769509305528625',
    name: 'Andreas Kling',
    company: 'SerenityOS & Ladybird',
    avatar:
      'https://pbs.twimg.com/profile_images/1743699387165925376/-Zd5Bwsi_400x400.jpg',
    text: (
      <>
        <p className="dark:text-polar-200 text-gray-500">
          I just used Polar to sponsor someone to improve Polar in Ladybird
          Browser!
        </p>
        <p>
          It&apos;s honestly such a comfy way to spread the love and share some
          of my funding with more of our developers!
        </p>
      </>
    ),
  },
  {
    link: 'https://x.com/cpojer/status/1795905984977576017',
    name: 'Christoph Nakazawa',
    avatar:
      'https://pbs.twimg.com/profile_images/1189537722286952449/OrscO0bD_400x400.jpg',
    company: 'Athena Crisis',
    text: (
      <>
        <p className="dark:text-polar-200 text-gray-500">
          It&apos;s only been two weeks but Polar has been extremely good for
          funding contributions for Athena Crisis.
        </p>
        <p>Frictionless, fast, easy.</p>
      </>
    ),
  },
  {
    link: 'https://x.com/samuel_colvin/status/1676167205715582978',
    name: 'Samuel Colvin',
    company: 'Pydantic',
    avatar:
      'https://pbs.twimg.com/profile_images/1678332260569710594/of0Ed11O_400x400.jpg',
    text: (
      <>
        <p className="dark:text-polar-200 text-gray-500">
          Amazing! Really excited to seeing how this turns out.
        </p>
        <p>
          Polar is the cutting edge of how open source might be financed in the
          future.
        </p>
      </>
    ),
  },
]

const Testamonials = () => {
  return (
    <motion.div
      className="flex flex-col divide-y"
      initial="initial"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ delay: 0.2, duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <Link
        className="hover:bg-gray-75 dark:hover:bg-polar-900 flex flex-col gap-y-6 p-8 transition-colors"
        href={testamonials[0].link}
        target="_blank"
      >
        <div className="flex flex-col gap-y-4 text-lg md:w-2/3">
          {testamonials[0].text}
        </div>
        <div className="flex flex-row items-center gap-x-4">
          <Avatar
            className="h-10 w-10"
            avatar_url={testamonials[0].avatar}
            name={testamonials[0].name}
          />

          <div className="flex flex-col text-sm">
            <span>{testamonials[0].name}</span>
            <span className="dark:text-polar-500 text-gray-500">
              {testamonials[0].company}
            </span>
          </div>
        </div>
      </Link>
      <div className="flex flex-col items-center divide-y md:flex-row md:divide-x md:divide-y-0">
        {testamonials.slice(1).map((testamonial) => (
          <Link
            key={testamonial.name}
            className="flex h-full flex-col md:w-1/3"
            href={testamonial.link}
            target="_blank"
          >
            <div className="hover:bg-gray-75 dark:hover:bg-polar-900 group relative flex h-full w-full flex-col gap-y-8 rounded-none border-none p-8 transition-colors">
              <div className="flex h-full flex-col gap-y-4 leading-relaxed">
                {testamonial.text}
              </div>
              <div className="flex flex-row items-center gap-x-4 space-y-0">
                <Avatar
                  className="h-10 w-10"
                  avatar_url={testamonial.avatar}
                  name={testamonial.name}
                />
                <div className="flex flex-col text-sm">
                  <span>{testamonial.name}</span>
                  <span className="dark:text-polar-500 text-gray-500">
                    {testamonial.company}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  )
}

const MOCKED_PRODUCTS: Partial<Product>[] = [
  {
    name: 'Follower',
    type: 'free',
    description: 'A simple way to follow my projects.',

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
      'Access to my weekly newsletter, my private GitHub repository & invite to my Discord server.',
    prices: [
      {
        id: '123',
        created_at: new Date().toDateString(),
        price_amount: 1900,
        price_currency: 'usd',
        type: 'recurring',
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
        description: 'Access to GitHub repository',
        type: 'github_repository',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '789',
        description: 'Discord Invite',
        type: 'discord',
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
      'Exclusive support, exposure in my weekly newsletter & premium role on Discord.',
    prices: [
      {
        id: '123',
        created_at: new Date().toDateString(),
        price_amount: 299900,
        price_currency: 'usd',
        type: 'recurring',
        recurring_interval: 'month',
        is_archived: false,
      },
    ],
    benefits: [
      {
        id: '123',
        description: 'Your logotype in Newsletter',
        type: 'articles',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '456',
        description: 'Access to GitHub repository',
        type: 'github_repository',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '789',
        description: 'Premium Role on Discord',
        type: 'discord',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
    ],
  },
]
