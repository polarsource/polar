'use client'

import LogoIcon from '@/components/Brand/logos/LogoIcon'
import { useOnboardingData } from '@/components/Onboarding/OnboardingContext'
import { CONFIG } from '@/utils/config'
import Link from 'next/link'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { usePostHog } from '@/hooks/posthog'
import { redirect, useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()
  const posthog = usePostHog()
  const { updateData } = useOnboardingData()

  if (CONFIG.IS_SANDBOX) {
    redirect('/onboarding/sandbox')
  }

  const handleSandbox = () => {
    posthog.capture(
      'dashboard:onboarding:mode:click',
      { mode: 'sandbox', source: 'onboarding_start' },
      { send_instantly: true },
    )
    window.location.href = `${CONFIG.SANDBOX_FRONTEND_BASE_URL}/login?return_to=/onboarding/sandbox&from=onboarding`
  }

  const handleGetStarted = () => {
    posthog.capture('dashboard:onboarding:mode:click', {
      mode: 'production',
      source: 'onboarding_start',
    })
    updateData({
      buildingIntent: ['setting_up_business'],
    })
    router.push('/onboarding/personal')
  }

  return (
    <Box
      backgroundColor="background-primary"
      display="flex"
      minHeight="100vh"
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="l"
      position="relative"
    >
      <Box
        position="absolute"
        bottom={24}
        left={24}
        display="flex"
        gap="l"
        color="text-tertiary"
      >
        <Link
          href="/dashboard/account/preferences"
          className="dark:hover:text-polar-200 text-sm hover:text-gray-900"
        >
          User settings
        </Link>
        <a
          href={`${CONFIG.BASE_URL}/v1/auth/logout`}
          className="dark:hover:text-polar-200 text-sm hover:text-gray-900"
        >
          Log out
        </a>
      </Box>
      <Box
        display="flex"
        width="100%"
        maxWidth="48rem"
        flexDirection="column"
        alignItems="center"
        rowGap="2xl"
      >
        <LogoIcon size={48} />

        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          rowGap="s"
          textAlign="center"
        >
          <h1 className="text-2xl font-medium text-gray-900 dark:text-white">
            Welcome to Polar
          </h1>
          <p className="dark:text-polar-400 text-gray-500">
            What are you looking to do?
          </p>
        </Box>

        <Box
          display="grid"
          width="100%"
          gridTemplateColumns={{
            base: 'repeat(1, minmax(0, 1fr))',
            md: 'repeat(2, minmax(0, 1fr))',
          }}
          gap="l"
        >
          {/* Left card — Sandbox */}
          <Box
            backgroundColor="background-card"
            borderColor="border-primary"
            borderWidth={1}
            borderStyle="solid"
            borderRadius="l"
            display="flex"
            flexDirection="column"
            justifyContent="between"
            padding="xl"
          >
            <Box display="flex" flexDirection="column" rowGap="s">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                I&apos;m just exploring
              </h2>
              <p className="dark:text-polar-400 text-sm text-gray-500">
                Jump into a sandbox environment with test data and mock
                payments. No real money, no setup required.
              </p>
            </Box>
            <Box marginTop="xl">
              <Button fullWidth onClick={handleSandbox}>
                Launch sandbox
              </Button>
            </Box>
          </Box>

          {/* Right card — Business setup */}
          <Box
            backgroundColor="background-card"
            borderColor="border-primary"
            borderWidth={1}
            borderStyle="solid"
            borderRadius="l"
            display="flex"
            flexDirection="column"
            justifyContent="between"
            padding="xl"
          >
            <Box display="flex" flexDirection="column" rowGap="s">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                I&apos;m setting up my business
              </h2>
              <p className="dark:text-polar-400 text-sm text-gray-500">
                Set up your organization and start accepting payments.
              </p>
            </Box>
            <Box marginTop="xl">
              <Button fullWidth onClick={handleGetStarted}>
                Get started
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
