import { LabeledSeparator } from 'polarkit/components/ui/atoms'
import GithubLoginButton from '../Auth/GithubLoginButton'
import MagicLinkLoginForm from '../Auth/MagicLinkLoginForm'
import GoogleLoginButton from './GoogleLoginButton'

const Login = ({ returnTo }: { returnTo?: string }) => {
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
  )
}

export default Login
