'use client'

import { useAuth, useLogout } from '@/hooks'
import { Button } from '@polar-sh/orbit'
import { OnboardingLayout } from '../Layout/OnboardingLayout'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { ONBOARDING_STEPS, type OnboardingStepId } from './OnboardingStepper'

interface OnboardingShellProps {
  title: string
  subtitle?: string
  step?: OnboardingStepId
  actions?: ReactNode
  children: ReactNode
}

const footerLinkClassName =
  'dark:hover:text-polar-200 text-sm hover:text-gray-900'

function FooterLinks({ hadOrgs }: { hadOrgs: boolean }) {
  const logout = useLogout()

  return (
    <Box gap="l" flexWrap="wrap" color="text-tertiary">
      {hadOrgs && (
        <Link href="/dashboard" className={footerLinkClassName}>
          Back to dashboard
        </Link>
      )}
      <Link
        href="/dashboard/account/preferences"
        className={footerLinkClassName}
      >
        User settings
      </Link>
      <button
        type="button"
        onClick={logout}
        className={`cursor-pointer ${footerLinkClassName}`}
      >
        Log out
      </button>
    </Box>
  )
}

export function OnboardingShell({
  title,
  subtitle,
  step,
  actions,
  children,
}: OnboardingShellProps) {
  const router = useRouter()
  const { userOrganizations } = useAuth()
  const [hadOrgs] = useState(() => userOrganizations.length > 0)
  const currentIndex = step
    ? ONBOARDING_STEPS.findIndex((s) => s.id === step)
    : -1

  return (
    <OnboardingLayout
      branding={
        <Box color="text-primary">
          <PolarLogotype logoVariant="logotype" logoClassName="ml-0" />
        </Box>
      }
      footer={<FooterLinks hadOrgs={hadOrgs} />}
      mobileFooter={
        <Box
          display={{ base: 'flex', lg: 'none' }}
          justifyContent="center"
          paddingTop="xl"
          marginBottom="xl"
        >
          <FooterLinks hadOrgs={hadOrgs} />
        </Box>
      }
      steps={step ? ONBOARDING_STEPS : undefined}
      currentStepIndex={currentIndex}
      onStepSelect={(stepId) => {
        const selectedStep = ONBOARDING_STEPS.find(({ id }) => id === stepId)
        if (selectedStep) router.push(selectedStep.route)
      }}
      title={title}
      subtitle={subtitle}
      actions={
        actions ? (
          <Box
            width="100%"
            alignItems="center"
            justifyContent="between"
            gap="m"
          >
            <Box>
              {currentIndex > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    router.push(ONBOARDING_STEPS[currentIndex - 1].route)
                  }
                >
                  Back
                </Button>
              )}
            </Box>
            {actions}
          </Box>
        ) : undefined
      }
    >
      {children}
    </OnboardingLayout>
  )
}
