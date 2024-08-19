'use client'

import {
  AttachMoneyOutlined,
  DiamondOutlined,
  HiveOutlined,
} from '@mui/icons-material'
import GitHubIcon from '../Icons/GitHubIcon'
import SubscriptionTierCard from '../Subscriptions/SubscriptionTierCard'
import FeatureItem from './molecules/FeatureItem'
import { MOCKED_PRODUCTS } from './utils'

export const Monetization = () => {
  // const circleRadius = 80

  return (
    <div className="flex flex-col gap-y-24 md:gap-y-32">
      <div className="flex flex-col gap-y-16">
        <div className="relative flex flex-col items-center gap-y-2 text-center md:gap-y-6">
          <h2 className="text-2xl leading-snug md:text-5xl">
            From first donation to IPO
          </h2>
          <h3 className="dark:text-polar-500 text-xl leading-snug text-gray-400 md:text-4xl">
            Polar offers features to scale with your needs
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
      </div>

      {/* <Link
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
      </Link> */}
    </div>
  )
}
