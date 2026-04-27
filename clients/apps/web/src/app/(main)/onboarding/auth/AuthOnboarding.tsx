'use client'

import Login from '@/components/Auth/Login'
import { OnboardingShell } from '@/components/Onboarding/OnboardingShell'
import { useAuth } from '@/hooks'
import { Box } from '@polar-sh/orbit/Box'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const METHOD_LABELS: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  apple: 'Apple',
  email: 'email',
  code: 'email',
}

const POST_AUTH_REDIRECT_DELAY_MS = 1500

export default function AuthOnboarding({
  intent,
  lastLoginMethod,
}: {
  intent: 'signup' | 'login'
  lastLoginMethod: string | null
}) {
  const router = useRouter()
  const { currentUser } = useAuth()

  useEffect(() => {
    if (!currentUser) return
    const t = setTimeout(
      () => router.push('/onboarding/personal'),
      POST_AUTH_REDIRECT_DELAY_MS,
    )
    return () => clearTimeout(t)
  }, [currentUser, router])

  if (currentUser) {
    const providerLabel =
      METHOD_LABELS[lastLoginMethod ?? ''] ?? 'your provider'
    return (
      <OnboardingShell
        title={`Signing you in with ${providerLabel}`}
        subtitle="Just a moment — setting up your account."
        step="auth"
        apiStep="auth"
        authMethod={lastLoginMethod ?? undefined}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          paddingVertical="2xl"
        >
          <Loader2
            size={32}
            className="dark:text-polar-400 animate-spin text-gray-400"
          />
        </Box>
      </OnboardingShell>
    )
  }

  const title = intent === 'login' ? 'Welcome back' : 'Welcome to Polar'
  const subtitle =
    intent === 'login'
      ? 'Sign in to continue setting up your business.'
      : "Create your account to get started, it's free, requires no credit card and only takes a few seconds."

  return (
    <OnboardingShell
      title={title}
      subtitle={subtitle}
      step="auth"
      apiStep="personal"
    >
      <Login
        signup={intent === 'signup' ? { intent: 'creator' } : undefined}
        returnTo="/onboarding/auth"
      />
    </OnboardingShell>
  )
}
