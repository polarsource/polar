'use client'

import LogoIcon from '@/components/Brand/logos/LogoIcon'
import { useOnboardingData } from '@/components/Onboarding/v2/OnboardingContext'
import { CONFIG } from '@/utils/config'
import { Box } from '@polar-sh/orbit/Box'
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
    <Box
      backgroundColor="background-primary"
      display="flex"
      minHeight="100vh"
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="l"
    >
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
            borderRadius="lg"
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
            borderRadius="lg"
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
