'use client'

import {
  getAuthenticationSessionRedirectPath,
  getOrgAuthenticationSessionCompleteURL,
} from '@/utils/auth'
import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { SpinnerNoMargin, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import AppleLoginButton from './AppleLoginButton'
import EmailOTPForm from './EmailOTPForm'
import GitHubLoginButton from './GitHubLoginButton'
import GoogleLoginButton from './GoogleLoginButton'
import SSOLoginButton from './SSOLoginButton'

type AuthenticationSession = schemas['AuthenticationSession']
type Factor = AuthenticationSession['available_factors'][number]
type SSOFactor = Extract<Factor, { type: 'sso' }>

const OrDivider = () => (
  <Box alignItems="center" gap="l">
    <Box
      flexGrow={1}
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    />
    <Text variant="caption" color="muted">
      or
    </Text>
    <Box
      flexGrow={1}
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    />
  </Box>
)

const OrgAuth = ({ slug, returnTo }: { slug: string; returnTo?: string }) => {
  const router = useRouter()
  const [session, setSession] = useState<AuthenticationSession | null>(null)
  const [status, setStatus] = useState<
    'loading' | 'completing' | 'ready' | 'error'
  >('loading')
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) {
      return
    }
    initialized.current = true

    const init = async () => {
      const { data: existing, response } = await api.GET('/v1/auth/status')

      // /status is global and omits org SSO factors, so only trust it after an
      // identity is attached (return-from-callback): advance or complete.
      if (response.ok && existing && existing.identity_id) {
        if (existing.available_factors.length === 0) {
          setStatus('completing')
          window.location.href = getOrgAuthenticationSessionCompleteURL(slug)
          return
        }
        const redirectPath = getAuthenticationSessionRedirectPath(existing)
        if (redirectPath) {
          setStatus('completing')
          router.push(redirectPath)
          return
        }
        setSession(existing)
        setStatus('ready')
        return
      }

      // Start an org-scoped session to get this org's factors (SSO + base).
      const { data: started, error } = await api.POST('/v1/auth/{slug}/start', {
        params: { path: { slug } },
        body: { return_to: returnTo },
      })
      if (error || !started) {
        setStatus('error')
        return
      }
      setSession(started)
      setStatus('ready')
    }

    init()
  }, [slug, returnTo, router])

  if (status === 'error') {
    return (
      <Box
        borderRadius="m"
        backgroundColor="background-warning"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-warning"
        padding="l"
      >
        <Text>
          Could not load single sign-on for this organization. Please try again.
        </Text>
      </Box>
    )
  }

  if (status === 'completing' || status === 'loading' || !session) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        gap="m"
        paddingVertical="2xl"
      >
        <SpinnerNoMargin />
        <Text color="muted">
          {status === 'completing'
            ? 'Signing you in…'
            : 'Loading sign-in options…'}
        </Text>
      </Box>
    )
  }

  const factors = session.available_factors
  const ssoFactors = factors.filter((f): f is SSOFactor => f.type === 'sso')
  const hasApple = factors.some((f) => f.type === 'apple')
  const hasGithub = factors.some((f) => f.type === 'github')
  const hasGoogle = factors.some((f) => f.type === 'google')
  const hasEmail = factors.some((f) => f.type === 'email_otp')
  const hasBaseFactor = hasApple || hasGithub || hasGoogle || hasEmail

  return (
    <Box flexDirection="column" gap="l">
      {ssoFactors.map((factor) => (
        <SSOLoginButton
          key={factor.connection_id}
          organizationSlug={slug}
          connection={{ id: factor.connection_id, name: factor.name }}
          authenticationSession={session}
          returnTo={returnTo}
          variant="default"
        />
      ))}
      {ssoFactors.length > 0 && hasBaseFactor && <OrDivider />}
      {hasApple && (
        <AppleLoginButton
          authenticationSession={session}
          returnTo={returnTo}
          variant="secondary"
        />
      )}
      {hasGithub && (
        <GitHubLoginButton
          authenticationSession={session}
          returnTo={returnTo}
          variant="secondary"
        />
      )}
      {hasGoogle && (
        <GoogleLoginButton
          authenticationSession={session}
          returnTo={returnTo}
          variant="secondary"
        />
      )}
      {hasEmail && (
        <EmailOTPForm authenticationSession={session} returnTo={returnTo} />
      )}
    </Box>
  )
}

export default OrgAuth
