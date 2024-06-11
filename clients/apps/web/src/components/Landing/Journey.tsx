'use client'

import {
  AllInclusiveOutlined,
  AttachMoneyOutlined,
  DiamondOutlined,
  HiveOutlined,
  HowToVoteOutlined,
  ReceiptLongOutlined,
  TrendingUpOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { List } from 'polarkit/components/ui/atoms/list'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { StaggerReveal } from '../Shared/StaggerReveal'
import { Section } from './Section'
interface FeatureItemProps {
  className?: string
  icon?: JSX.Element
  title: string
  description: string
  link: string
}

const FeatureItem = ({
  title,
  icon,
  description,
  link,
  className,
}: FeatureItemProps) => {
  return (
    <StaggerReveal.Child key={title}>
      <Link
        className={twMerge('group flex h-full flex-col', className)}
        href={link}
      >
        <Card className="hover:bg-gray-75 dark:hover:bg-polar-900 flex h-full flex-col rounded-none border-none transition-colors dark:border-none">
          <CardHeader className="flex flex-row items-center gap-x-3 space-y-0 pb-4">
            {icon ? (
              <span className="dark:bg-polar-800 dark flex h-8 w-8 flex-col items-center justify-center rounded-lg bg-gray-200 transition-colors group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black">
                {React.cloneElement(icon, { fontSize: 'inherit' })}
              </span>
            ) : (
              <div className="-mr-4 h-10" />
            )}
            <h3 className="leading-snug">{title}</h3>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-y-4 pb-6">
            <p className="dark:text-polar-200 h-full text-sm leading-relaxed text-gray-500 group-hover:text-black dark:group-hover:text-white">
              {description}
            </p>
          </CardContent>
        </Card>
      </Link>
    </StaggerReveal.Child>
  )
}

const items = [
  {
    title: 'From idea to funding',
    description:
      'Polar has a wide array of monetization tools for your project, from one-time payments & recurring subscriptions to donations.',
    content: (
      <div className="flex flex-col gap-y-12">
        <div className="flex flex-col gap-y-4">
          <h2 className="text-2xl">From idea to funding</h2>
          <p className="dark:text-polar-200 text-gray-500">
            Pick & choose from a wide array of monetization tools.
          </p>
        </div>
        <StaggerReveal className="grid grid-cols-1 divide-y overflow-hidden rounded-3xl border md:grid-cols-1">
          <FeatureItem
            icon={<HowToVoteOutlined />}
            title="Issue Funding"
            description="Automatically embed the Polar funding badge on your GitHub issues to crowdfund your backlog."
            link="/docs/overview/issue-funding/overview"
          />
          <FeatureItem
            icon={<AttachMoneyOutlined />}
            title="Donations"
            description="Makes it a piece of cake for your supporters to show appreciation."
            link="/docs/overview/donations"
          />
          <FeatureItem
            icon={<AllInclusiveOutlined />}
            title="Subscriptions"
            description="Offer paid subscription tiers, with associated benefits that you give in return."
            link="/docs/overview/subscriptions"
          />
        </StaggerReveal>
      </div>
    ),
  },
  {
    title: 'From passion to business',
    description:
      'Polar helps you take a leap of faith & turn your passion project into a thriving business.',
    content: (
      <div className="flex flex-col gap-y-12">
        <div className="flex flex-col gap-y-4">
          <h2 className="text-2xl">From passion to business</h2>
          <p className="dark:text-polar-200 text-gray-500">
            Unlock the full potential of your project by selling digital
            products.
          </p>
        </div>
        <StaggerReveal className="grid grid-cols-1 divide-y overflow-hidden rounded-3xl border md:grid-cols-1">
          <FeatureItem
            icon={<DiamondOutlined />}
            title="Products"
            description="Sell licenses, access to private repositories, or any other digital product you can think of."
            link="/docs/overview/issue-funding/reward-contributors"
          />
          <FeatureItem
            icon={<TrendingUpOutlined />}
            title="Sales Metrics"
            description="We aggregate all your sales data into one place, so you can focus on what matters."
            link="/docs/overview/issue-funding/reward-contributors"
          />
          <FeatureItem
            icon={<ReceiptLongOutlined />}
            title="Newsletters"
            description="Reach your community with insightful newsletter posts."
            link="/docs/overview/issue-funding/reward-contributors"
          />
        </StaggerReveal>
      </div>
    ),
  },
]

export const Journey = () => {
  return (
    <Section
      className="flex-row gap-32 gap-y-24 py-24"
      wrapperClassName="relative"
    >
      <div className="flex w-1/3 flex-col gap-y-4 text-2xl">
        <h3>Focus on your passion —</h3>
        <h3 className="dark:text-polar-200 text-gray-500">
          While we build infrastructure to get you paid
        </h3>
      </div>
      <div className="flex w-2/3 flex-col gap-y-12">
        <div className="flex flex-row gap-x-12">
          {items.map((item) => (
            <div className="flex w-full flex-col" key={item.title}>
              {item.content}
            </div>
          ))}
        </div>
        <List>
          <FeatureItem
            icon={<HiveOutlined />}
            title="Benefits Engine"
            description="Polar's benefits engine allows you to offer exclusive benefits to your supporters."
            link="#"
          />
          <FeatureItem
            icon={<HiveOutlined />}
            title="Public Page"
            description="A home for your profile on Polar. Showcase your projects, crowdfunded issues, and more."
            link="#"
          />
          <FeatureItem
            icon={<ReceiptLongOutlined />}
            title="Merchant of Record"
            description="No more VAT headache - we handle the necessary taxes for you."
            link="/docs/overview/issue-funding/reward-contributors"
          />
        </List>
      </div>
    </Section>
  )
}
