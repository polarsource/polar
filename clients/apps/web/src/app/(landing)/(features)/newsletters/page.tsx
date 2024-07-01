import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { Post } from '@/components/Feed/Posts/Post'
import { FeatureSection } from '@/components/Landing/FeatureSection'
import { PageContent } from '@/components/Landing/LandingPage'
import { Section } from '@/components/Landing/Section'
import { Circles } from '@/components/Landing/molecules/Circles'
import { article } from '@/utils/testdata'
import { UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'

const PAGE_TITLE = 'Posts & Newsletters'
const PAGE_DESCRIPTION = 'Reach your audience with insightful posts and updates'

export default function Page() {
  return (
    <>
      <Section className="relative flex flex-col gap-16 md:flex-row md:justify-between md:py-24">
        <Circles className="absolute inset-0 top-1/2 -z-10 block -translate-y-1/2 text-black dark:hidden" />
        <Circles className="absolute inset-0 top-1/2 -z-10 hidden -translate-y-1/2 text-white dark:block" />
        <div className="relative flex flex-col gap-y-8 md:w-1/2">
          <h1 className="text-4xl md:text-5xl md:leading-snug">{PAGE_TITLE}</h1>
          <p className="text-lg md:text-xl md:leading-normal">
            {PAGE_DESCRIPTION}
          </p>
          <div className="flex flex-col gap-y-8">
            <GithubLoginButton
              className="self-start"
              size="large"
              text="Continue with GitHub"
              userSignupType={UserSignupType.MAINTAINER}
              returnTo="/maintainer"
            />
            <p className="dark:text-polar-500 text-xs leading-normal text-gray-400">
              By using Polar you agree to our{' '}
              <Link
                className="dark:text-polar-300 text-blue-500"
                href="/legal/terms"
                target="_blank"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                className="dark:text-polar-300 text-blue-500"
                href="/legal/privacy"
                target="_blank"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="relative md:w-1/2">
          <Link
            href="https://polar.sh/polarsource/posts/build-saas-with-polar"
            target="_blank"
          >
            <Post article={article} />
          </Link>
        </div>
      </Section>
      <Section
        className="md:py-24"
        wrapperClassName="bg-gray-50 dark:bg-polar-900"
      >
        <picture className="w-full">
          <source
            media="(prefers-color-scheme: dark)"
            srcSet="assets/landing/newsletters/newsletters_dark.png"
          />
          <img
            className="border-gray-75 dark:border-polar-700 rounded-4xl border shadow-2xl"
            alt="Newsletters"
            src="/assets/landing/newsletters/newsletters.png"
          />
        </picture>
      </Section>

      <FeatureSection
        title="Posts & Newsletters for Developers"
        description="Write in Markdown & preview in real-time"
        media={{
          light: '/assets/landing/newsletters/editor.png',
          dark: '/assets/landing/newsletters/editor_dark.png',
        }}
        features={[
          'Write in Markdown or MDX',
          'Preview in real-time',
          'GitHub-flavoured Markdown',
          'Built-in components - Paywalls, Subscription Upsells & more',
        ]}
      />

      <FeatureSection
        wrapperClassName="bg-gray-50 dark:bg-polar-900"
        title="Directly to your supporter's inbox"
        description="Distribute your newsletter via email with ease"
        media={{
          light: '/assets/landing/newsletters/metrics.png',
          dark: '/assets/landing/newsletters/metrics_dark.png',
        }}
        features={[
          'Publish newsletters via email',
          'Email metrics, analytics & insights',
        ]}
        direction="row-reverse"
      />

      <PageContent />
    </>
  )
}

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    description: PAGE_DESCRIPTION,
  },
  twitter: {
    description: PAGE_DESCRIPTION,
  },
}
