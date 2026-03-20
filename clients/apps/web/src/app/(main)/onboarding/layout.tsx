import { OnboardingProvider } from '@/components/Onboarding/v2/OnboardingContext'
import { CONFIG } from '@/utils/config'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode
}) {
  if (CONFIG.IS_SANDBOX) {
    redirect('/dashboard/create')
  }

  return <OnboardingProvider>{children}</OnboardingProvider>
}
