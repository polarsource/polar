'use client'

import { useAuth } from '@/hooks'
import { CONFIG } from '@/utils/config'
import { Box } from '@polar-sh/orbit/Box'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import LogoIcon from '../Brand/logos/LogoIcon'
import { type APIPreviewStep, APIPreview } from './APIPreview'

const STEPS = ['personal', 'business', 'product'] as const
const STEP_ROUTES = [
  '/onboarding/personal',
  '/onboarding/business',
  '/onboarding/product',
] as const

interface OnboardingShellProps {
  title: string
  subtitle?: string
  step?: 'personal' | 'business' | 'product'
  apiStep?: APIPreviewStep
  children: ReactNode
}

export function OnboardingShell({
  title,
  subtitle,
  step,
  apiStep,
  children,
}: OnboardingShellProps) {
  const router = useRouter()
  const { userOrganizations } = useAuth()
  const [hadOrgs] = useState(() => userOrganizations.length > 0)
  const currentIndex = step ? STEPS.indexOf(step) : -1

  return (
    <Box
      display="flex"
      minHeight="100vh"
      justifyContent="center"
      backgroundColor="background-primary"
      overflowX="hidden"
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
      <Box display="flex" width="100%" maxWidth="60rem">
        {/* Left: form */}
        <Box
          display="flex"
          flex={1}
          flexDirection="column"
          alignItems="center"
          paddingTop="5xl"
          paddingBottom="3xl"
          paddingHorizontal={{ base: 'l', lg: 'none' }}
        >
          <motion.div
            key={step ?? 'default'}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex w-full max-w-md flex-col gap-y-8"
          >
            {/* Logo + back + progress */}
            <Box
              position="relative"
              display="flex"
              flexDirection="column"
              rowGap="xl"
            >
              <Box display="flex" flexDirection="column" rowGap="xl">
                <Box display="flex" alignItems="center" justifyContent="center">
                  {currentIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => router.push(STEP_ROUTES[currentIndex - 1])}
                      className="dark:text-polar-400 dark:hover:text-polar-200 absolute left-0 text-gray-400 hover:text-gray-900"
                    >
                      <ArrowLeft size={20} />
                    </button>
                  )}
                  <LogoIcon size={36} />
                </Box>
                {step && (
                  <Box display="flex" width="100%" alignItems="center" gap="s">
                    {STEPS.map((s, i) => (
                      <Box key={s} display="flex" flex={1}>
                        <Box
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
                )}
              </Box>

              <Box display="flex" flexDirection="column" rowGap="m">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {title}
                </h1>
                {subtitle && (
                  <p className="dark:text-polar-400 text-sm text-gray-500">
                    {subtitle}
                  </p>
                )}
              </Box>
              {children}
              {hadOrgs && (
                <Link
                  href="/dashboard"
                  className="dark:text-polar-400 dark:hover:text-polar-200 text-center text-sm text-gray-500 hover:text-gray-900"
                >
                  Back to dashboard
                </Link>
              )}
            </Box>
          </motion.div>
        </Box>

        {/* Right: API preview */}
        <Box
          position="relative"
          display={{ base: 'none', lg: 'flex' }}
          width="40%"
          maxWidth="28rem"
          flexDirection="column"
          paddingHorizontal="2xl"
          paddingTop="5xl"
          paddingBottom="3xl"
        >
          <Box
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            right={-10000}
            backgroundColor="background-secondary"
          />
          <Box position="sticky" top={150} zIndex={1}>
            {(apiStep ?? step) && <APIPreview step={(apiStep ?? step)!} />}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
