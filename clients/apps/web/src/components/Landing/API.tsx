import { UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import GithubLoginButton from '../Auth/GithubLoginButton'
import { APIFirst } from './molecules/APIFirst'

export const API = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-y-16">
      <APIFirst />
      <div className="hidden flex-col items-center gap-y-12 text-center md:flex">
        <h1 className="text-5xl leading-snug">
          Custom experiences powered by Polar
        </h1>
        <p className="dark:text-polar-200 text-lg text-gray-500">
          Use our OAuth, API & Webhooks to ship custom integrations across docs,
          sites, apps and services.
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
              Explore the Polar API (Beta)
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
