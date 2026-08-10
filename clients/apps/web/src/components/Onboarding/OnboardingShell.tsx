'use client'

import { useAuth, useLogout } from '@/hooks'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import {
  ONBOARDING_STEPS,
  OnboardingStepper,
  type OnboardingStepId,
} from './OnboardingStepper'

interface OnboardingShellProps {
  title: string
  subtitle?: string
  step?: OnboardingStepId
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
  children,
}: OnboardingShellProps) {
  const router = useRouter()
  const { userOrganizations } = useAuth()
  const [hadOrgs] = useState(() => userOrganizations.length > 0)
  const currentIndex = step
    ? ONBOARDING_STEPS.findIndex((s) => s.id === step)
    : -1

  return (
    <Box
      minHeight="100vh"
      alignItems={{ base: undefined, lg: 'center' }}
      justifyContent="center"
      backgroundColor={{ base: undefined, lg: 'background-primary' }}
      overflowX="hidden"
      padding={{ base: 'none', lg: '2xl' }}
    >
      <Box
        width="100%"
        maxWidth={{ base: undefined, lg: '80rem' }}
        alignItems="stretch"
        columnGap="2xl"
        backgroundColor={{ base: undefined, lg: 'background-secondary' }}
        borderRadius="l"
        padding="s"
        borderWidth={{ base: 0, lg: 1 }}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <Box
          as="aside"
          display={{ base: 'none', lg: 'flex' }}
          width={320}
          flexShrink={0}
        >
          <Box
            position="sticky"
            top={0}
            flex={1}
            flexDirection="column"
            justifyContent="between"
            rowGap="2xl"
            padding="2xl"
            overflowY="auto"
          >
            <Box flexDirection="column" rowGap="3xl">
              <Box color="text-primary">
                <PolarLogotype logoVariant="logotype" />
              </Box>
              {step && <OnboardingStepper currentIndex={currentIndex} />}
            </Box>
            <FooterLinks hadOrgs={hadOrgs} />
          </Box>
        </Box>

        <Box
          as="main"
          flex={1}
          alignSelf={{ base: 'stretch', lg: 'center' }}
          flexDirection="column"
          alignItems="center"
          backgroundColor={{ base: undefined, lg: 'background-primary' }}
          borderRadius={{ base: 'none', lg: 'm' }}
          borderWidth={{ base: 0, lg: 1 }}
          borderStyle="solid"
          borderColor="border-secondary"
          paddingTop="3xl"
          paddingBottom="3xl"
          paddingHorizontal="l"
          height={{ base: undefined, lg: '48rem' }}
          overflowY="auto"
        >
          <motion.div
            key={step ?? 'default'}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex w-full max-w-md flex-col gap-y-8"
          >
            {step && (
              <Box
                display={{ base: 'flex', lg: 'none' }}
                flexDirection="column"
                width="100%"
                rowGap="l"
              >
                {currentIndex > 0 && (
                  <Box>
                    <button
                      type="button"
                      aria-label="Go back"
                      onClick={() =>
                        router.push(ONBOARDING_STEPS[currentIndex - 1].route)
                      }
                      className="dark:text-polar-400 dark:hover:text-polar-200 cursor-pointer text-gray-400 hover:text-gray-900"
                    >
                      <ArrowLeft size={18} />
                    </button>
                  </Box>
                )}
                <Box width="100%" alignItems="center" gap="s">
                  {ONBOARDING_STEPS.map((s, i) => (
                    <Box key={s.id} flex={1}>
                      <Box
                        display="block"
                        height={2}
                        width="100%"
                        borderRadius="full"
                        backgroundColor={
                          i <= currentIndex
                            ? 'background-inverse'
                            : 'background-card'
                        }
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            <Box flexDirection="column" rowGap="m">
              <Text variant="heading-xs">{title}</Text>
              {subtitle && (
                <Text variant="body" color="muted">
                  {subtitle}
                </Text>
              )}
            </Box>

            {children}

            <Box
              display={{ base: 'flex', lg: 'none' }}
              justifyContent="center"
              paddingTop="xl"
            >
              <FooterLinks hadOrgs={hadOrgs} />
            </Box>
          </motion.div>
        </Box>
      </Box>
    </Box>
  )
}
