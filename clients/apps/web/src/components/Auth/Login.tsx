'use client'

import { usePostHog, type EventName } from '@/hooks/posthog'
import { UserSignupAttribution } from '@polar-sh/sdk'
import { usePathname, useSearchParams } from 'next/navigation'
import { LabeledSeparator } from 'polarkit/components/ui/atoms'
import { useEffect } from 'react'
import GithubLoginButton from '../Auth/GithubLoginButton'
import MagicLinkLoginForm from '../Auth/MagicLinkLoginForm'
import GoogleLoginButton from './GoogleLoginButton'

const Login = ({
  returnTo,
  returnParams,
  signup,
}: {
  returnTo?: string
  returnParams?: Record<string, string>
  signup?: UserSignupAttribution
}) => {
  const posthog = usePostHog()

  let loginProps = {}
  const pathname = usePathname()
  const searchParams = useSearchParams()

  let eventName: EventName = 'global:user:login:view'
  if (signup) {
    eventName = 'global:user:signup:view'

    if (!returnTo) {
      returnTo = `/dashboard/create`
    }

    signup.path = pathname

    const host = typeof window !== 'undefined' ? window.location.host : ''
    if (host) {
      signup.host = host
    }

    const utm = {
      source: searchParams.get('utm_source') ?? '',
      medium: searchParams.get('utm_medium') ?? '',
      campaign: searchParams.get('utm_campaign') ?? '',
    }
    if (utm.source) {
      signup.utm_source = utm.source
    }
    if (utm.medium) {
      signup.utm_medium = utm.medium
    }
    if (utm.campaign) {
      signup.utm_campaign = utm.campaign
    }

    loginProps = { signup }
  }

  if (returnTo) {
    const returnToParams = new URLSearchParams(returnParams)
    if (returnToParams) {
      returnTo = `${returnTo || ''}?${returnToParams}`
    }

    loginProps = { returnTo, ...loginProps }
  }

  useEffect(() => {
    posthog.capture(eventName, loginProps)
  }, [])

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex w-full flex-col gap-y-4">
        <GithubLoginButton
          text="Continue with GitHub"
          size="large"
          fullWidth
          {...loginProps}
        />
        <GoogleLoginButton {...loginProps} />
        <LabeledSeparator label="Or" />
        <MagicLinkLoginForm {...loginProps} />
      </div>
      <div className="dark:text-polar-500 mt-6 text-center text-xs text-gray-400">
        By using Polar you agree to our{' '}
        <a
          className="dark:text-polar-300 text-gray-600"
          href="https://polar.sh/legal/terms"
        >
          Terms of Service
        </a>{' '}
        and{' '}
        <a
          className="dark:text-polar-300 text-gray-600"
          href="https://polar.sh/legal/privacy"
        >
          Privacy Policy
        </a>
      </div>
    </div>
  )
}

export default Login
