import { OnboardingProvider } from '@/components/Onboarding/v2/OnboardingContext'
import { CONFIG } from '@/utils/config'
import type { ReactNode } from 'react'

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode
}) {
  if (CONFIG.IS_SANDBOX) {
    return <>{children}</>
  }

  return <OnboardingProvider>{children}</OnboardingProvider>
}
