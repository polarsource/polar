import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import Link from 'next/link'
import { Separator } from 'polarkit/components/ui/separator'
import { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

export default function Page() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <AnimatedSeparator />
      <BenefitUpsell />
    </div>
  )
}

const AnimatedSeparator = ({
  className,
  ...props
}: ComponentProps<typeof Separator>) => {
  return (
    <Separator
      className={twMerge('dark:bg-polar-700 bg-blue-100', className)}
      {...props}
    />
  )
}

const BlueLink = ({ className, ...props }: ComponentProps<typeof Link>) => {
  return (
    <Link
      className={twMerge(
        'text-blue-400 hover:text-blue-300 dark:text-blue-300 dark:hover:text-blue-200',
        className,
      )}
      {...props}
    />
  )
}

const HeroSection = () => {
  return (
    <div className="flex w-full flex-row">
      <div className="flex w-2/5 flex-col gap-y-12 px-12 py-16">
        <div className="flex flex-col gap-y-8">
          <h1 className="text-pretty text-4xl !font-semibold leading-tight text-blue-500">
            Get paid coding on your passion
          </h1>
          <p className="dark:text-polar-500 text-xl leading-relaxed text-gray-400">
            Polar is the creator platform for developers. Offer your supporters
            & customers a subscription designed for the developer ecosystem.
          </p>
        </div>

        <div className="flex flex-col items-start gap-y-8">
          <GithubLoginButton size="large" text="Sign up with GitHub" />
          <p className="dark:text-polar-500 text-xs text-gray-400">
            By using Polar you agree to our{' '}
            <BlueLink href="/legal/terms">Terms of Service</BlueLink> and{' '}
            <BlueLink href="/legal/privacy">Privacy Policy</BlueLink>.
          </p>
        </div>
      </div>
      <AnimatedSeparator className="flex-grow" orientation="vertical" />
      <div className="dark:bg-polar-900 flex w-3/5 flex-col bg-gray-100"></div>
    </div>
  )
}

const BenefitUpsell = () => {
  return (
    <div className="flex flex-row">
      <div className="dark:bg-polar-900 flex w-3/5 flex-col bg-gray-100"></div>
      <div className="flex w-2/5 flex-col gap-y-12 px-12 py-16">
        <div className="flex flex-col gap-y-8">
          <h1 className="text-pretty text-4xl !font-semibold leading-tight text-blue-500">
            Powerful & built-in subscription benefits
          </h1>
          <p className="dark:text-polar-500 text-xl leading-relaxed text-gray-400">
            Polar is built open source & in public. We&apos;re just getting
            started.
          </p>
        </div>
      </div>
    </div>
  )
}
