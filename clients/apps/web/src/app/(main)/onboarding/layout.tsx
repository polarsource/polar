import { OnboardingProvider } from '@/components/Onboarding/OnboardingContext'
import type { ReactNode } from 'react'

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode
}) {
  return <OnboardingProvider>{children}</OnboardingProvider>
}
