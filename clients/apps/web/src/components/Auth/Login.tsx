'use client'

import { LogoType70 } from 'polarkit/components/brand'
import { LabeledSeparator } from 'polarkit/components/ui'
import GithubLoginButton from '../Shared/GithubLoginButton'
import MagicLinkLoginForm from '../Shared/MagicLinkLoginForm'
import { useLoginRedirect } from './Redirector'

const Login = ({ gotoUrl }: { gotoUrl?: string }) => {
  useLoginRedirect()

  return (
    <div className="flex h-screen w-full grow items-center justify-center bg-[#FEFDF9] dark:bg-gray-950">
      <div id="polar-bg-gradient"></div>
      <div className="flex w-80 flex-col items-center gap-6">
        <LogoType70 className="h-10" />
        <div className="w-full">
          <GithubLoginButton
            text="Sign in with GitHub"
            size="large"
            fullWidth
            gotoUrl={gotoUrl}
            posthogProps={{
              view: 'Login Page',
            }}
          />
        </div>
        <LabeledSeparator label="Or" />
        <MagicLinkLoginForm />
        <div className="mt-8 text-center text-sm text-gray-500">
          By using Polar you agree to our{' '}
          <a
            className="text-gray-700 dark:text-gray-300"
            href="https://polar.sh/legal/terms"
          >
            Terms of Service
          </a>{' '}
          and understand our{' '}
          <a
            className="text-gray-700 dark:text-gray-300"
            href="https://polar.sh/legal/privacy"
          >
            Privacy Policy
          </a>
          .
        </div>
      </div>
    </div>
  )
}

export default Login
