import { LabeledSeparator } from 'polarkit/components/ui/atoms'
import GithubLoginButton from '../Auth/GithubLoginButton'
import MagicLinkLoginForm from '../Auth/MagicLinkLoginForm'

const Login = ({ returnTo }: { returnTo?: string }) => {
  return (
    <div className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-gray-100">
      <div className="flex w-full max-w-5xl flex-row">
        <div className="md:dark:bg-polar-900 flex w-full flex-col justify-between gap-8 p-16 md:aspect-square md:bg-white">
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-4">
              <h2 className="dark:text-polar-50 text-3xl text-blue-500">
                Welcome to Polar
              </h2>
              <h2 className="dark:text-polar-400 text-xl text-gray-500">
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
        <div
          className="hidden aspect-square w-full flex-col gap-8 bg-blue-500 bg-cover bg-center p-16 md:flex"
          style={{ backgroundImage: `url(/assets/brand/polar_login.png)` }}
        ></div>
      </div>
    </div>
  )
}

export default Login
