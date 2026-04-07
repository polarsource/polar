'use client'

import { usePostHog, type EventName } from '@/hooks/posthog'
import { schemas } from '@polar-sh/client'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'

import GithubLoginButton from '../Auth/GithubLoginButton'
import LoginCodeForm from '../Auth/LoginCodeForm'
import AppleLoginButton from './AppleLoginButton'
import GoogleLoginButton from './GoogleLoginButton'

const Login = ({
  returnTo,
  returnParams,
  signup,
  lastLoginMethod,
}: {
  returnTo?: string
  returnParams?: Record<string, string>
  signup?: schemas['UserSignupAttribution']
  lastLoginMethod?: string | null
}) => {
  const posthog = usePostHog()

  const pathname = usePathname()
  const searchParams = useSearchParams()

  const eventName: EventName = signup
    ? 'global:user:signup:view'
    : 'global:user:login:view'

  const resolvedReturnTo = useMemo(() => {
    const path = returnTo ?? '/dashboard'

    if (returnParams) {
      const returnToParams = new URLSearchParams(returnParams)
      if (returnToParams.size) {
        return `${path}?${returnToParams}`
      }
    }

    return path
  }, [returnTo, returnParams])

  const loginProps = useMemo(() => {
    let eventData = {}

    if (signup) {
      const signupEvent = { ...signup, path: pathname }

      const host = typeof window !== 'undefined' ? window.location.host : ''
      if (host) {
        signupEvent.host = host
      }

      const campaign = searchParams.get('campaign') ?? ''
      if (campaign) {
        signupEvent.campaign = campaign
      }

      const utm = {
        source: searchParams.get('utm_source') ?? '',
        medium: searchParams.get('utm_medium') ?? '',
        campaign: searchParams.get('utm_campaign') ?? '',
      }
      if (utm.source) {
        signupEvent.utm_source = utm.source
      }
      if (utm.medium) {
        signupEvent.utm_medium = utm.medium
      }
      if (utm.campaign) {
        signupEvent.utm_campaign = utm.campaign
      }

      eventData = { signup: signupEvent }
    }

    return { returnTo: resolvedReturnTo, ...eventData }
  }, [pathname, resolvedReturnTo, searchParams, signup])

  useEffect(() => {
    posthog.capture(eventName, loginProps)
  }, [eventName, loginProps, posthog])

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex w-full flex-col gap-y-4">
        <LastUsedWrapper show={lastLoginMethod === 'github'}>
          <GithubLoginButton size="large" fullWidth {...loginProps} />
        </LastUsedWrapper>
        <LastUsedWrapper show={lastLoginMethod === 'google'}>
          <GoogleLoginButton {...loginProps} />
        </LastUsedWrapper>
        <LastUsedWrapper show={lastLoginMethod === 'apple'}>
          <AppleLoginButton {...loginProps} />
        </LastUsedWrapper>
        <div className="flex w-full flex-row items-center gap-6">
          <div className="dark:border-polar-700 grow border-t border-gray-200" />
          <div className="text-sm text-gray-500">or</div>
          <div className="dark:border-polar-700 grow border-t border-gray-200" />
        </div>
        <LastUsedWrapper show={lastLoginMethod === 'email'}>
          <LoginCodeForm {...loginProps} />
        </LastUsedWrapper>
      </div>
      <div className="dark:text-polar-500 mt-6 text-center text-xs text-balance text-gray-400">
        By using Polar, you agree to our{' '}
        <a
          className="dark:text-polar-300 text-gray-600"
          href="https://polar.sh/legal/master-services-terms"
        >
          Terms of Service
        </a>{' '}
        &amp;{' '}
        <a
          className="dark:text-polar-300 text-gray-600"
          href="https://polar.sh/legal/privacy-policy"
        >
          Privacy Policy
        </a>
        .
      </div>
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

export default Login
