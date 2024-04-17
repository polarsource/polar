import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { Separator } from 'polarkit/components/ui/separator'
import { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

export default function Page() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <AnimatedSeparator />
      <BenefitsUpsell />
      <AnimatedSeparator />
      <FeaturesUpsell />
      <AnimatedSeparator />
      <DevelopersUpsell />
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

const BenefitsUpsell = () => {
  return (
    <div className="flex flex-row py-16">
      <div className="dark:bg-polar-900 flex w-3/5 flex-col bg-gray-100"></div>
      <div className="flex w-2/5 flex-col gap-y-12 px-12">
        <div className="flex flex-col gap-y-8">
          <h1 className="text-pretty text-4xl !font-semibold leading-tight text-blue-500">
            Powerful & built-in subscription benefits
          </h1>
          <p className="dark:text-polar-500 text-xl leading-relaxed text-gray-400">
            Polar is built open source & in public. We&apos;re just getting
            started.
          </p>
        </div>
        <div className="flex flex-col gap-y-8">
          <ul className="flex flex-col gap-y-4">
            <li>
              <span className="font-medium">Premium posts & newsletter</span>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Offer your paid subscribers early sneak peaks, educational
                content, code examples and more.
              </p>
            </li>
            <li>
              <span className="font-medium">
                Access to private GitHub repositories
              </span>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Enabling early access, sponsorware, self-hosted products,
                starter kits, courses and so much more.
              </p>
            </li>
            <li>
              <span className="font-medium">Discord invites</span>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Setup custom roles per tier. Enabling membership channels to
                individuals & support for businesses.
              </p>
            </li>
            <li>
              <span className="font-medium">Sponsorship 2.0</span>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Offer logo promotions on README, sites and posts. Polar will
                automate it. No more manual overhead.
              </p>
            </li>
          </ul>
        </div>
        <div className="flex flex-row items-center gap-x-4">
          <Button>GitHub</Button>
          <Button>Join our Discord</Button>
        </div>
      </div>
    </div>
  )
}

const FeaturesUpsell = () => {
  return (
    <div className="dark:divide-polar-700 grid grid-cols-3 divide-x divide-y divide-blue-100">
      <div className="col-span-1 flex min-h-96 flex-col items-center justify-center gap-y-2 p-12 text-center">
        <h3 className="text-lg text-blue-500">
          Individual & Business subscriptions
        </h3>
        <p className="dark:text-polar-500 text-gray-500">
          Separate membership perks & commercial offerings.
        </p>
      </div>
      <div className="col-span-2 flex min-h-52 flex-col items-center justify-center gap-y-2 p-12 text-center">
        <h3 className="text-lg text-blue-500">Posts & Newletter</h3>
        <p className="dark:text-polar-500 text-gray-500">
          Write posts in an editor designed for developers. Share them with
          everyone, paid subscribers or a mix (paywalled sections).
        </p>
      </div>
      <div className="col-start-2 col-end-3 flex min-h-52 flex-col items-center justify-center gap-y-2 p-12 text-center">
        <h3 className="text-lg text-blue-500">API & SDK</h3>
        <p className="dark:text-polar-500 text-gray-500">
          Integrate it all on your own docs, sites or services using our API &
          SDK.
        </p>
      </div>
      <div className="col-start-3 col-end-4 flex min-h-52 flex-col items-center justify-center gap-y-2 p-12 text-center">
        <h3 className="text-lg text-blue-500">Value-add taxes handled</h3>
        <p className="dark:text-polar-500 text-gray-500">
          We handle it as the merchant of record.
        </p>
      </div>
      <div className="col-start-1 col-end-2 flex min-h-52 flex-col items-center justify-center gap-y-2 p-12 text-center">
        <h3 className="text-lg text-blue-500">Get a funded backlog</h3>
        <p className="dark:text-polar-500 text-gray-500">
          Built for open source maintainers, not bounty hunters. Empower your
          community to pool funding toward issues.
        </p>
      </div>
      <div className="col-span-2 flex min-h-52 flex-col items-center justify-center gap-y-2 p-12 text-center">
        <h3 className="text-lg text-blue-500">Reward contributors</h3>
        <p className="dark:text-polar-500 text-gray-500">
          Share issue funding with contributors easily.
        </p>
      </div>
    </div>
  )
}

const DevelopersUpsell = () => {
  return (
    <div className="flex flex-row py-16">
      <div className="dark:bg-polar-900 flex w-3/5 flex-col bg-gray-100"></div>
      <div className="flex w-2/5 flex-col gap-y-12 px-12">
        <div className="flex flex-col gap-y-8">
          <h1 className="text-pretty text-4xl !font-semibold leading-tight text-blue-500">
            Serving world-class developers
          </h1>
          <p className="dark:text-polar-500 text-xl leading-relaxed text-gray-400">
            We&apos;re proud to support incredible developers and open source
            initiatives that are shaping the future. Join us today.
          </p>
        </div>
      </div>
    </div>
  )
}
