'use client'

import { LabeledSeparator } from 'polarkit/components/ui/atoms'
import GithubLoginButton from '../Auth/GithubLoginButton'
import MagicLinkLoginForm from '../Auth/MagicLinkLoginForm'
import GoogleLoginButton from './GoogleLoginButton'
import { UserSignupAttribution } from '@polar-sh/sdk'
import { useSearchParams, usePathname } from 'next/navigation'

const Login = ({
  returnTo,
  signup
}: {
  returnTo?: string
  signup?: UserSignupAttribution
}) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (signup) {
    const attribution = searchParams.get('attribution')
    if (attribution) {
      signup.source = attribution
    } else {
      signup.source = pathname
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex w-full flex-col gap-y-4">
        <GithubLoginButton
          text="Continue with GitHub"
          size="large"
          fullWidth
          returnTo={returnTo}
          posthogProps={{
            view: 'Login Page',
          }}
        />
        <GoogleLoginButton returnTo={returnTo} />
        <LabeledSeparator label="Or" />
        <MagicLinkLoginForm returnTo={returnTo} signup={signup} />
      </div>
      <div className="dark:text-polar-500 text-sm text-gray-400">
        By using Polar you agree to our{' '}
        <a
          className="dark:text-polar-300 text-gray-600"
          href="https://polar.sh/legal/terms"
        >
          Terms of Service
        </a>{' '}
        and understand our{' '}
        <a
          className="dark:text-polar-300 text-gray-600"
          href="https://polar.sh/legal/privacy"
        >
          Privacy Policy
        </a>
        .
      </div>
    </div>
  )
}

export default Login
