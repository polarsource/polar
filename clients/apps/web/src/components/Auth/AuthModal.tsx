import { schemas } from '@polar-sh/client'
import Login from './Login'

interface AuthModalProps {
  returnTo?: string
  returnParams?: Record<string, string>
  signup?: schemas['UserSignupAttribution']
}

export const AuthModal = ({
  returnTo,
  returnParams,
  signup,
}: AuthModalProps) => {
  const isSignup = signup !== undefined

  const lastLoginMethod =
    typeof document !== 'undefined'
      ? (document.cookie.match(/polar_last_login_method=(\w+)/)?.[1] ?? null)
      : null

  return (
    <div className="overflow-y-auto p-12">
      <div className="flex flex-col justify-between gap-y-12">
        {isSignup && (
          <div className="flex flex-col gap-y-1">
            <h1 className="text-xl font-medium">Welcome to Polar</h1>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              The billing platform built for AI companies.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-y-12">
          <Login
            returnTo={returnTo}
            returnParams={returnParams}
            signup={signup}
            lastLoginMethod={lastLoginMethod}
          />
        </div>
      </div>
    </div>
  )
}
