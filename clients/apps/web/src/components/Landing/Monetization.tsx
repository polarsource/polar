'use client'

import {
  AttachMoneyOutlined,
  DiamondOutlined,
  FileDownloadOutlined,
  HiveOutlined,
  StickyNote2Outlined,
  TuneOutlined,
  VerifiedOutlined,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { twMerge } from 'tailwind-merge'
import { DiscordIcon } from '../Benefit/utils'
import GitHubIcon from '../Icons/GitHubIcon'
import SubscriptionTierCard from '../Subscriptions/SubscriptionTierCard'
import FeatureItem from './molecules/FeatureItem'
import { MOCKED_PRODUCTS } from './utils'

interface BenefitCardProps {
  className?: string
  title: string
  description: string
  icon: JSX.Element
}

const BenefitCard = ({
  className,
  title,
  description,
  icon,
}: BenefitCardProps) => {
  return (
    <Link
      href="/benefits"
      className={twMerge(
        'hover:bg-gray-75 dark:hover:bg-polar-900 dark:bg-polar-950 flex flex-col justify-between gap-y-8 bg-white p-8 transition-colors',
        className,
      )}
    >
      <span>{icon}</span>
      <div className="flex flex-col gap-y-2">
        <h3>{title}</h3>
        <p className="dark:text-polar-200 text-gray-500">{description}</p>
      </div>
    </Link>
  )
}

const Benefits = () => {
  return (
    <>
      <div className="flex flex-col items-center gap-y-4 text-center md:gap-y-8">
        <h2 className="text-2xl leading-snug md:text-5xl">
          Powerful & built-in benefits
        </h2>
        <p className="dark:text-polar-600 text-xl leading-snug text-gray-300 md:text-4xl">
          We&apos;re building common developer upsells so you don&apos;t have to
        </p>
      </div>
      <div className="rounded-4xl grid grid-cols-1 overflow-hidden border md:grid-cols-3">
        <BenefitCard
          className="border-b md:border-r"
          icon={<GitHubIcon width={30} height={30} />}
          title="Private GitHub Repositories"
          description="Automate access to an unlimited amount of private GitHub repositories."
        />
        <BenefitCard
          className="border-b md:border-r"
          icon={
            <FileDownloadOutlined className="text-4xl" fontSize="inherit" />
          }
          title="File Downloads"
          description="From e-books, source code to executibles - any file is supported up to 10GB/each."
        />
        <BenefitCard
          className="border-b"
          icon={<StickyNote2Outlined className="text-4xl" fontSize="inherit" />}
          title="Free & Premium Newsletters"
          description="Write a free, premium or early access newsletter in GitHub flavoured markdown."
        />
        <BenefitCard
          className="border-b md:border-b-0 md:border-r"
          icon={<DiscordIcon size={30} />}
          title="Discord Invites & Roles"
          description="Give customers exclusive access or premium appearances and permissions."
        />
        <BenefitCard
          className="border-b md:border-b-0 md:border-r"
          icon={<VerifiedOutlined className="text-4xl" fontSize="inherit" />}
          title="Sponsor Promotion"
          description="Automate README.md logotypes and offer newsletter sponsorship."
        />
        <BenefitCard
          icon={<TuneOutlined className="text-4xl" fontSize="inherit" />}
          title="Custom Benefit"
          description="Create your own and share secret notes, e.g Cal.com link to book consultation."
        />
      </div>
      <div className="-mt-12 text-center">
        <p className="dark:bg-polar-800 dark:border-polar-700 dark:text-polar-400 inline-block rounded-full bg-gray-100 px-4 py-2 text-gray-400 dark:border">
          License keys, private packages & more to come
        </p>
      </div>
    </>
  )
}

export const Monetization = () => {
  const circleRadius = 80

  return (
    <>
      <div className="flex flex-col items-center gap-y-24 md:gap-y-32">
        <motion.div
          className="relative flex flex-col gap-y-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1, transition: { duration: 2 } }}
        >
          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcSet={`/assets/landing/overview_dark.png`}
            />
            <img
              className="dark:border-polar-700 rounded-4xl border border-gray-200"
              srcSet={`/assets/landing/overview.png`}
            />
          </picture>
          <div className="dark:from-polar-950 absolute inset-0 flex flex-col items-center justify-end gap-y-2 bg-gradient-to-t from-white from-25% to-transparent to-80% p-6 text-center md:gap-y-8 md:p-12 dark:to-transparent">
            <h2 className="text-2xl leading-snug md:text-5xl">
              From first donation to IPO
            </h2>
            <h3 className="dark:text-polar-600 text-xl leading-snug text-gray-300 md:text-4xl">
              Polar offers features to scale with your needs
            </h3>
          </div>
        </motion.div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <FeatureItem
            className="md:row-span-2"
            icon={<DiamondOutlined />}
            title="Products & Subscriptions"
            description="Start offering developer first products and services in minutes - paid once, monthly or annually."
            link="/products"
          >
            <SubscriptionTierCard
              className="dark:bg-polar-800 dark:border-polar-800 shadow-3xl border-transparent bg-white"
              subscriptionTier={MOCKED_PRODUCTS[1]}
            />
          </FeatureItem>
          <FeatureItem
            className="md:col-span-2"
            icon={<GitHubIcon width={20} height={20} />}
            title="Issue Funding & Rewards"
            description="Crowdfunded backlog or community bounties with seamless support to split funds with contributors."
            link="/issue-funding"
          >
            <picture>
              <source
                media="(prefers-color-scheme: dark)"
                srcSet={`/assets/landing/fund_dark.svg`}
              />
              <img
                className="dark:border-polar-700 rounded-2xl border border-gray-100"
                srcSet={`/assets/landing/fund.svg`}
                alt="Polar crowdfunding badge embedded on a GitHub issue"
              />
            </picture>
          </FeatureItem>
          <FeatureItem
            className="md:col-span-1"
            icon={<AttachMoneyOutlined />}
            title="Donations"
            description="Get appreciation from your community for a great newsletter, release or ongoing development."
            link="/donations"
          />
          <FeatureItem
            icon={<HiveOutlined />}
            title="Custom Integrations & SaaS"
            description="Use our API & SDK to integrate Polar across your docs, sites, apps or services."
            link="#integrations"
          />
        </div>

        <Benefits />

        <div className="flex flex-col items-center gap-y-4 text-center md:gap-y-8">
          <h2 className="text-2xl leading-snug md:text-5xl">
            Supporting all use cases
          </h2>
          <p className="dark:text-polar-600 text-xl leading-snug text-gray-300 md:text-4xl">
            From sustainable open source, sponsorware to full-fledged SaaS
          </p>
        </div>
        <div className="rounded-4xl flex flex-col divide-y overflow-hidden border md:flex-row md:divide-x md:divide-y-0">
          {[
            {
              name: 'Serenity OS',
              username: '@serenityos',
              avatar: 'https://avatars.githubusercontent.com/u/50811782?v=4',
              text: 'Using Polar with Issue Funding to promote rewards for contributors.',
              link: 'https://polar.sh/serenityos',
            },
            {
              name: 'Capawesome',
              username: '@capawesome-team',
              avatar: 'https://avatars.githubusercontent.com/u/105555861?v=4',
              text: 'Offering early access to sponsors using Subscription Tiers.',
              link: 'https://polar.sh/capawesome-team',
            },
            {
              name: 'Your Next Store',
              username: '@yournextstore',
              avatar: 'https://avatars.githubusercontent.com/u/159799280?v=4',
              text: 'Selling e-commerce starter kit using Polar Products & Subscriptions.',
              link: 'https://polar.sh/yournextstore',
            },
          ].map((testamonial) => (
            <Link
              key={testamonial.name}
              className="hover:bg-gray-75 dark:hover:bg-polar-900 group relative flex flex-col transition-colors md:w-1/3"
              href={testamonial.link}
              target="_blank"
            >
              <div className=" flex h-full w-full flex-col gap-y-8 rounded-none border-none p-10">
                <div className="flex flex-row items-center gap-4 space-y-0">
                  <Avatar
                    className="h-12 w-12"
                    avatar_url={testamonial.avatar}
                    name={testamonial.name}
                  />
                  <div className="flex flex-col">
                    <span>{testamonial.name}</span>
                    <span className="dark:text-polar-500 text-sm text-gray-500">
                      {testamonial.username}
                    </span>
                  </div>
                </div>
                <div className="flex h-full flex-col gap-y-4 leading-relaxed">
                  {testamonial.text}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <Link
          className="relative hidden h-64 w-64 flex-col items-center justify-center rounded-full md:flex"
          href="https://polar.sh/polarsource/posts/github-supports-polar-in-funding-yaml"
        >
          <GitHubIcon
            className="text-black dark:text-white"
            width={60}
            height={60}
          />
          <div className="absolute inset-0 h-full w-full animate-spin fill-black text-xl font-semibold uppercase tracking-wide [animation-duration:32s] dark:fill-white">
            <svg
              x="0"
              y="0"
              viewBox="0 0 300 300"
              enableBackground="new 0 0 300 300"
              xmlSpace="preserve"
            >
              <defs>
                <path
                  id="circlePath"
                  d={`
          M 150, 150
          m -${circleRadius}, 0
          a ${circleRadius},${circleRadius} 0 0,1 ${circleRadius * 2},0
          a ${circleRadius},${circleRadius} 0 0,1 -${circleRadius * 2},0
          `}
                />
              </defs>
              <g>
                <text fontSize={12}>
                  <textPath xlinkHref="#circlePath" textLength={80 * 6.1}>
                    Official Funding Option · Official Funding Option ·
                  </textPath>
                </text>
              </g>
            </svg>
          </div>
        </Link>
      </div>
    </>
  )
}
