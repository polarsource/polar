'use client'

import LogoIcon from '@/components/Brand/logos/LogoIcon'
import { useOnboardingData } from '@/components/Onboarding/v2/OnboardingContext'
import { CONFIG } from '@/utils/config'
import Button from '@polar-sh/ui/components/atoms/Button'
import { redirect, useRouter } from 'next/navigation'

export default function Page() {
  if (CONFIG.IS_SANDBOX) {
    redirect('/onboarding/personal')
  }

  const router = useRouter()
  const { updateData } = useOnboardingData()

  const handleSandbox = () => {
    window.location.href = `${CONFIG.SANDBOX_FRONTEND_BASE_URL}/login?return_to=/onboarding/personal&from=onboarding`
  }

  const handleGetStarted = () => {
    updateData({
      buildingIntent: ['setting_up_business'],
    })
    router.push('/onboarding/personal')
  }

  return (
    <div className="dark:bg-polar-950 flex min-h-screen items-center justify-center bg-white px-4">
      <div className="flex w-full max-w-3xl flex-col items-center gap-y-8">
        <LogoIcon size={48} />

        <div className="flex flex-col items-center gap-y-2 text-center">
          <h1 className="text-2xl font-medium text-gray-900 dark:text-white">
            Welcome to Polar
          </h1>
          <p className="dark:text-polar-400 text-gray-500">
            What are you looking to do?
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          {/* Left card — Sandbox */}
          <div className="dark:border-polar-700 dark:bg-polar-800 flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex flex-col gap-y-2">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                I&apos;m just exploring
              </h2>
              <p className="dark:text-polar-400 text-sm text-gray-500">
                Jump into a sandbox environment with test data and mock
                payments. No real money, no setup required.
              </p>
            </div>
            <div className="mt-6">
              <Button fullWidth onClick={handleSandbox}>
                Launch sandbox
              </Button>
            </div>
          </div>

          {/* Right card — Business setup */}
          <div className="dark:border-polar-700 dark:bg-polar-800 flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex flex-col gap-y-2">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                I&apos;m setting up my business
              </h2>
              <p className="dark:text-polar-400 text-sm text-gray-500">
                Set up your organization and start accepting payments.
              </p>
            </div>
            <div className="mt-6">
              <Button fullWidth onClick={handleGetStarted}>
                Get started
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
