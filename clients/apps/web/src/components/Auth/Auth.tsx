'use client'

import { type EventName } from '@/hooks/posthog'
import { schemas } from '@polar-sh/client'
import { type LoginMethod } from '@/utils/auth'
import { Fragment } from 'react'
import GoogleLoginButton from './GoogleLoginButton'
import EmailOTPForm from './EmailOTPForm'
import AppleLoginButton from './AppleLoginButton'
import AuthTermsFooter from './AuthTermsFooter'
import GitHubLoginButton from './GitHubLoginButton'
import { usePathname, useSearchParams } from 'next/navigation'
import { useImpressionEvent } from '@/hooks/useImpressionEvent'
import { type JsonType } from '@posthog/core'

type OAuthFactor = Exclude<LoginMethod, 'email_otp' | 'totp'>
const OAUTH_FACTORS: OAuthFactor[] = ['apple', 'github', 'google']

const isOAuthFactor = (
  value: LoginMethod | null | undefined,
): value is OAuthFactor =>
  !!value && (OAUTH_FACTORS as string[]).includes(value)

const Auth = ({
  authenticationSession,
  lastLoginMethod,
  returnTo,
  signup,
}: {
  authenticationSession: schemas['AuthenticationSession'] | null
  lastLoginMethod?: LoginMethod | null
  returnTo?: string
  signup?: boolean
}) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const eventName: EventName = signup
    ? 'global:user:signup:view'
    : 'global:user:login:view'
  const eventData: Record<string, JsonType> = signup
    ? {
        signup: {
          path: pathname,
          host: typeof window !== 'undefined' ? window.location.host : '',
          campaign: searchParams.get('campaign') ?? '',
          utm_source: searchParams.get('utm_source') ?? '',
          utm_medium: searchParams.get('utm_medium') ?? '',
          utm_campaign: searchParams.get('utm_campaign') ?? '',
        },
      }
    : {}
  useImpressionEvent({
    event: eventName,
    build: () => eventData,
  })

  const primaryOAuthFactor: OAuthFactor = isOAuthFactor(lastLoginMethod)
    ? lastLoginMethod
    : 'google'
  const orderedOAuthFactors: OAuthFactor[] = [
    primaryOAuthFactor,
    ...OAUTH_FACTORS.filter(
      (f) => isOAuthFactor(f) && f !== primaryOAuthFactor,
    ),
  ]

  const renderOAuth = (factor: OAuthFactor, isPrimary: boolean) => {
    const variant = isPrimary ? 'default' : 'secondary'
    switch (factor) {
      case 'apple':
        return (
          <AppleLoginButton
            authenticationSession={authenticationSession}
            variant={variant}
            returnTo={returnTo}
            signup={signup}
          />
        )
      case 'github':
        return (
          <GitHubLoginButton
            authenticationSession={authenticationSession}
            variant={variant}
            returnTo={returnTo}
            signup={signup}
          />
        )
      case 'google':
        return (
          <GoogleLoginButton
            authenticationSession={authenticationSession}
            variant={variant}
            returnTo={returnTo}
            signup={signup}
          />
        )
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex w-full flex-col gap-y-4">
        {orderedOAuthFactors.map((factor, index) => (
          <Fragment key={factor}>
            <LastUsedWrapper show={lastLoginMethod === factor}>
              {renderOAuth(factor, index === 0)}
            </LastUsedWrapper>
          </Fragment>
        ))}
        <div className="flex w-full flex-row items-center gap-6">
          <div className="dark:border-polar-700 grow border-t border-gray-200" />
          <div className="text-sm text-gray-500">or</div>
          <div className="dark:border-polar-700 grow border-t border-gray-200" />
        </div>
        <LastUsedWrapper show={lastLoginMethod === 'email_otp'}>
          <EmailOTPForm
            authenticationSession={authenticationSession}
            returnTo={returnTo}
            signup={signup}
          />
        </LastUsedWrapper>
      </div>
      <AuthTermsFooter />
    </div>
  )
}

const LastUsedWrapper = ({
  show,
  children,
}: {
  show: boolean
  children: React.ReactNode
}) => (
  <div className="relative">
    {show && (
      <span className="dark:bg-polar-900 dark:border-polar-600 absolute -top-3 -right-2 z-20 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-black dark:text-white">
        Last used
      </span>
    )}
    {children}
  </div>
)

export default Auth
