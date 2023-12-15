import { LogoType70 } from 'polarkit/components/brand'
import { LabeledSeparator } from 'polarkit/components/ui/atoms'
import GithubLoginButton from '../Shared/GithubLoginButton'
import MagicLinkLoginForm from '../Shared/MagicLinkLoginForm'

const Login = ({ gotoUrl }: { gotoUrl?: string }) => {
  return (
    <div className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-[#FEFDF9]">
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
        <MagicLinkLoginForm gotoUrl={gotoUrl} />
        <div className="mt-8 text-center text-sm text-gray-500">
          By using Polar you agree to our{' '}
          <a
            className="dark:text-polar-300 text-gray-700"
            href="https://polar.sh/legal/terms"
          >
            Terms of Service
          </a>{' '}
          and understand our{' '}
          <a
            className="dark:text-polar-300 text-gray-700"
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
