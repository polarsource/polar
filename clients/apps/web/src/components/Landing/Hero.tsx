import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { Section } from '@/components/Landing/Section'
import { UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'

export const Hero = () => {
  return (
    <Section
      className="flex w-full flex-col gap-y-12 py-24"
      wrapperClassName="relative isolate border-b dark:border-polar-800 border-gray-100"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,.2) 3%, transparent 3%)',
          backgroundPosition: '0 0',
          backgroundSize: '20px 20px',
        }}
      />
      <div className="z-20 flex flex-col gap-y-16">
        <h1 className="w-3/4 text-balance text-7xl leading-tight tracking-tight text-gray-950 dark:text-white">
          Earn a living on your passion projects
        </h1>
        <div className="flex flex-col gap-y-4">
          <p className="text-balance text-xl leading-loose">
            With a funding & monetization platform for open source & indie
            developers
          </p>
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
      <div className="z-20 flex flex-col gap-y-8">
        <GithubLoginButton
          className="self-start"
          size="large"
          text="Continue with GitHub"
          userSignupType={UserSignupType.MAINTAINER}
          returnTo="/maintainer"
        />
      </div>
    </Section>
  )
}
