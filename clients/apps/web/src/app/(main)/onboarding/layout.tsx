import { OnboardingProvider } from '@/components/Onboarding/OnboardingContext'
import { requireAuthenticatedUser } from '@/utils/user'
import type { ReactNode } from 'react'

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireAuthenticatedUser()

  return <OnboardingProvider>{children}</OnboardingProvider>
}
