import { UserSignupType } from '@polar-sh/sdk'
import GithubLoginButton from '../Auth/GithubLoginButton'
import { Section } from './Section'

export const LastPitch = () => {
  return (
    <Section className="flex flex-col items-center justify-center gap-y-16">
      <div className="flex flex-col items-center gap-y-12 text-center">
        <div className="flex flex-col items-center gap-y-4">
          <h1 className="text-center text-4xl">
            We&apos;ve run out of sales pitches
          </h1>
          <p className="dark:text-polar-200 text-center text-xl text-gray-500">
            For now. We ship fast and open source. So stay tuned.
          </p>
        </div>
        <div className="md: flex flex-col gap-4 md:flex-row">
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
