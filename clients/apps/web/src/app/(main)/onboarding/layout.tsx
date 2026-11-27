import { OnboardingProvider } from '@/components/Onboarding/OnboardingContext'
import { AuthProvider } from '@/providers/AuthProvider'
import { requireAuthenticatedUser } from '@/utils/user'
import type { ReactNode } from 'react'

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireAuthenticatedUser()

  return (
    <AuthProvider>
      <OnboardingProvider>{children}</OnboardingProvider>
    </AuthProvider>
  )
}
