import { OnboardingProvider } from '@/components/Onboarding/v2/OnboardingContext'
import type { ReactNode } from 'react'

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <OnboardingProvider>
      {children}
    </OnboardingProvider>
  )
}
