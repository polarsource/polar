import { LabeledSeparator } from 'polarkit/components/ui/atoms'
import GithubLoginButton from '../Auth/GithubLoginButton'
import MagicLinkLoginForm from '../Auth/MagicLinkLoginForm'
import GoogleLoginButton from './GoogleLoginButton'

const Login = ({ returnTo }: { returnTo?: string }) => {
  return (
    <div className="flex h-screen w-full grow items-center justify-center">
      <div className="flex w-full max-w-md flex-col justify-between gap-8 p-16">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl text-black dark:text-white">
              Welcome to Polar
            </h2>
            <h2 className="dark:text-polar-400 text-lg text-gray-500">
              The all-in-one funding & monetization platform for developers
            </h2>
          </div>
        </div>
        <div className="flex flex-col gap-y-4">
          <div className="flex w-full flex-col gap-y-4">
            <GithubLoginButton
              text="Sign in with GitHub"
              size="large"
              fullWidth
              returnTo={returnTo}
              posthogProps={{
                view: 'Login Page',
              }}
            />
            <GoogleLoginButton returnTo={returnTo} />
            <LabeledSeparator label="Or" />
            <MagicLinkLoginForm returnTo={returnTo} />
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
      </div>
    </div>
  )
}

export default Login
