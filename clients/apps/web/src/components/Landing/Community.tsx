'use client'

import { Language, TrendingUpOutlined } from '@mui/icons-material'
import GitHubIcon from '../Icons/GitHubIcon'
import FeatureItem from './molecules/FeatureItem'

export const Community = () => {
  return (
    <div key="section-community" className="flex flex-col gap-y-24">
      <div className="flex flex-col items-center gap-y-4 text-center md:gap-y-8">
        <h2 className="text-4xl leading-snug md:text-5xl">
          Grow community alongside transactions
        </h2>
        <h3 className="dark:text-polar-600 text-4xl leading-snug text-gray-500">
          Crucial for successful developer tools. So it&apos;s built-in - for
          free.
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <FeatureItem
          icon={<Language />}
          title="Polar Page"
          description="Social bio links for developers. Showcase your repos, products, subscriptions, newsletter and more."
          link="https://polar.sh/polarsource"
          linkDescription="Checkout our Polar Page"
        />
        <FeatureItem
          className="md:col-span-2 md:row-span-2"
          icon={<TrendingUpOutlined />}
          title="Free & Premium Newsletters"
          description="Offer online- and email newsletters to your community - at no additional cost. Write posts in GitHub flavoured markdown. Share them with all subscribers, paid ones or as early access."
          link="/newsletters"
        >
          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcSet={`/assets/landing/newsletter_dark.png`}
            />
            <img
              className="dark:border-polar-700 rounded-2xl border border-gray-100"
              srcSet={`/assets/landing/newsletter_light.png`}
              alt="Write newsletters in GitHub flavoured markdown"
            />
          </picture>
        </FeatureItem>
        <FeatureItem
          icon={<GitHubIcon width={20} height={20} />}
          title="Official GitHub Option"
          description="GitHub offers first-class support for Polar Pages in FUNDING.yaml. Convert stars into community members."
          link="https://polar.sh/polarsource/posts/github-supports-polar-in-funding-yaml"
          linkDescription="Read announcement"
        />
      </div>
    </div>
  )
}
