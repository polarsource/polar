import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import LogoIcon from '../Brand/LogoIcon'
import { UserSignupAttribution } from '@polar-sh/sdk'
import Login from './Login'

interface AuthModalProps {
  returnTo?: string
  returnParams?: Record<string, string>
  signup?: UserSignupAttribution
}

export const AuthModal = ({
  returnTo,
  returnParams,
  signup,
}: AuthModalProps) => {
  const isSignup = signup !== undefined
  const title = isSignup ? 'Sign Up' : 'Sign In'

  const copy =
    isSignup ? (
      <p className="dark:text-polar-500 text-xl text-gray-500">
        Join thousands of developers &amp; startups monetizing their products with Polar.
      </p>
    ) : null

  return (
    <ShadowBox className="overflow-y-auto p-12">
      <div className="flex flex-col justify-between gap-y-16">
        <LogoIcon className="text-black dark:text-white" size={60} />

        <div className="flex flex-col gap-y-4">
          <h1 className="text-3xl">{title}</h1>
          {copy}
        </div>

        <div className="flex flex-col gap-y-12">
          <Login returnTo={returnTo} returnParams={returnParams} signup={signup} />
        </div>
      </div>
    </ShadowBox>
  )
}
