'use client'

import {
  AccountBalanceOutlined,
  ArrowForwardOutlined,
  AttachMoneyOutlined,
  DiamondOutlined,
  HiveOutlined,
  Language,
  ReceiptLongOutlined,
  TrendingUpOutlined,
  Webhook,
} from '@mui/icons-material'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import React, { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import GitHubIcon from '../Icons/GitHubIcon'
import SubscriptionTierCard from '../Subscriptions/SubscriptionTierCard'
import { Section } from './Section'
import { MOCKED_PRODUCTS } from './utils'

interface FeatureItemProps {
  className?: string
  icon?: JSX.Element
  title: string
  description: string
  link: string
  learnMore?: boolean
}

const FeatureItem = ({
  title,
  icon,
  description,
  link,
  learnMore = true,
  className,
  children,
}: PropsWithChildren<FeatureItemProps>) => {
  return (
    <Link
      className={twMerge('group flex h-full flex-col', className)}
      href={link}
    >
      <Card className="dark:border-polar-800 dark:from-polar-950 dark:to-polar-900 flex h-full flex-col bg-gradient-to-tr from-white to-blue-50/50 p-1 transition-colors">
        <CardHeader className="flex flex-row items-center gap-x-3 space-y-0 pb-4">
          {icon ? (
            <span className="dark:bg-polar-700 dark flex h-10 w-10 flex-col items-center justify-center rounded-full bg-white text-xl shadow-sm transition-colors group-hover:text-blue-500">
              {React.cloneElement(icon, { fontSize: 'inherit' })}
            </span>
          ) : (
            <div className="-mr-4 h-10" />
          )}
          <h3 className="text-lg leading-snug">{title}</h3>
        </CardHeader>
        <CardContent className="flex h-full flex-col gap-y-4 pb-6">
          <p className="dark:text-polar-200 h-full leading-relaxed text-gray-500 transition-colors group-hover:text-black dark:group-hover:text-white">
            {description}
          </p>
          {learnMore && (
            <div className="dark:text-polar-200 flex flex-row items-center gap-x-2 text-sm transition-colors group-hover:text-blue-500 dark:group-hover:text-white">
              <span>Learn more</span>
              <ArrowForwardOutlined fontSize="inherit" />
            </div>
          )}
        </CardContent>
        {children && (
          <CardFooter className="mt-4 flex flex-row items-center">
            {children}
          </CardFooter>
        )}
      </Card>
    </Link>
  )
}

const items = [
  {
    title: 'From first donation to IPO',
    description:
      'Polar has a wide array of monetization tools for your project, from one-time payments & recurring subscriptions to donations.',
    content: (
      <div key="section-core-features" className="flex flex-col gap-y-24">
        <div className="flex flex-col gap-y-4">
          <h2 className="text-4xl leading-snug md:text-5xl">
            From first donation to IPO
          </h2>
          <h3 className="dark:text-polar-600 text-4xl leading-snug text-gray-500">
            Polar offers features to scale with your needs.
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <FeatureItem
            className="md:row-span-2"
            icon={<DiamondOutlined />}
            title="Products & Subscriptions"
            description="Start offering developer first products and services in minutes - paid once, monthly or annually."
            link="/products"
          >
            <SubscriptionTierCard
              className="dark:bg-polar-900 dark:border-polar-800 border-transparent bg-white shadow-sm"
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
            icon={<HiveOutlined />}
            title="Powerful Built-in Benefits"
            description="We're building common developer upsells so you don't have to."
            link="#benefits"
          >
            <ul>
              {[
                'GitHub Repo(s) Access',
                'File Downloads',
                'Discord Invites',
                'Newsletter Access',
                'Ads',
                'Custom',
              ].map((upsell, i) => (
                <li key={`upsell-${i}`} className="mb-2 mr-2 inline-block">
                  <p className="rounded-2xl border border-gray-900 px-3 py-1.5 text-xs text-gray-600">
                    {upsell}
                  </p>
                </li>
              ))}
              <li className="mb-2 mr-2 inline-block">
                <p className="text-sm text-gray-600">+ More coming</p>
              </li>
            </ul>
          </FeatureItem>
          <FeatureItem
            className="md:col-span-1"
            icon={<AttachMoneyOutlined />}
            title="Donations"
            description="Official GitHub FUNDING.yaml option. Get appreciation from your community for a great post, release or ongoing development."
            link="/donations"
          />
        </div>

        <div className="flex flex-col divide-y overflow-hidden rounded-3xl border md:flex-row md:divide-x md:divide-y-0">
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
      </div>
    ),
  },
  {
    title: 'From passion to business',
    description:
      'Polar helps you take a leap of faith & turn your passion project into a thriving business.',
    content: (
      <div key="section-mor" className="flex flex-col gap-y-24">
        <div className="flex flex-col gap-y-4">
          <h2 className="text-4xl leading-snug md:text-5xl">
            From passion to business
          </h2>
          <h3 className="dark:text-polar-600 text-4xl leading-snug text-gray-500">
            Unlock the full potential of your project with insights to your
            sales
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <FeatureItem
            className="md:col-span-2 md:row-span-2"
            icon={<TrendingUpOutlined />}
            title="Sales Metrics"
            description="We aggregate all your sales data into one place, so you can focus on what matters."
            link="/docs/overview/issue-funding/reward-contributors"
          >
            <picture>
              <source
                media="(prefers-color-scheme: dark)"
                srcSet={`/assets/landing/sales_dark.png`}
              />
              <img
                className="dark:border-polar-700 rounded-2xl border border-gray-100"
                srcSet={`/assets/landing/sales.png`}
              />
            </picture>
          </FeatureItem>
          <FeatureItem
            icon={<ReceiptLongOutlined />}
            title="Merchant of Record"
            description="No more VAT headache - we handle the necessary taxes for you."
            link="/docs/overview/payments-taxes#taxes"
          />
          <FeatureItem
            icon={<AccountBalanceOutlined />}
            title="Payouts"
            description="Withdraw your earnings with ease. Supporting Stripe & Open Collective."
            link="/docs/overview/payments-taxes"
          />
          <FeatureItem
            icon={<Webhook />}
            title="Webhooks"
            description="Integrate with the Polar API for real-time updates on funding events."
            link="/docs/api-reference/webhooks"
          />
          <FeatureItem
            icon={<Language />}
            title="Public Page"
            description="A home for your profile on Polar. Showcase your projects, crowdfunded issues, and more."
            link="#"
            learnMore={false}
          />
          <FeatureItem
            icon={<ReceiptLongOutlined />}
            title="Newsletters"
            description="Reach your community with insightful newsletter posts - using an MDX-powered editor."
            link="/docs/overview/issue-funding/reward-contributors"
          />
        </div>
      </div>
    ),
  },
]

export const Journey = () => {
  return (
    <Section className="flex flex-col gap-y-24">
      {items.map((item) => item.content)}
    </Section>
  )
}
