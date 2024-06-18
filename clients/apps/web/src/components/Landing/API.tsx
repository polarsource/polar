import { UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import GithubLoginButton from '../Auth/GithubLoginButton'
import { Section } from './Section'
import { APIFirst } from './molecules/APIFirst'

export const API = () => {
  return (
    <Section className="flex flex-col items-center justify-center gap-y-16">
      <APIFirst />
      <div className="hidden flex-col items-center gap-y-12 text-center md:flex">
        <h1 className="text-5xl leading-snug">Seamless integrations</h1>
        <p className="dark:text-polar-200 text-lg text-gray-500">
          We built Polar with the developer experience in mind
        </p>
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <GithubLoginButton
            className="self-start"
            text="Continue with GitHub"
            userSignupType={UserSignupType.MAINTAINER}
            returnTo="/maintainer"
          />
          <Link href="/docs/api-reference/introduction">
            <Button size="lg" variant="ghost">
              Explore the Polar API
            </Button>
          </Link>
        </div>
      </div>
      <div className="flex flex-col items-center gap-y-12 text-center md:hidden">
        <h1 className="text-2xl leading-snug md:text-5xl">
          We&apos;ve run out of sales pitches
        </h1>
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <GithubLoginButton
            text="Signup with GitHub"
            size="large"
            userSignupType={UserSignupType.MAINTAINER}
            returnTo="/maintainer"
          />
        </div>
      </div>
    </Section>
  )
}
