'use client'

import {
  AttachMoneyOutlined,
  DiamondOutlined,
  HiveOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import GitHubIcon from '../Icons/GitHubIcon'
import SubscriptionTierCard from '../Subscriptions/SubscriptionTierCard'
import FeatureItem from './molecules/FeatureItem'
import { MOCKED_PRODUCTS } from './utils'

export const Monetization = () => {
  return (
    <div className="flex flex-col gap-y-24">
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
          description="Get appreciation from your community for a great newsletter, release or ongoing development."
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
  )
}
