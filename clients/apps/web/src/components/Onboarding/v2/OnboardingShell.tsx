'use client'

import { Box } from '@polar-sh/orbit/Box'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import LogoIcon from '../../Brand/logos/LogoIcon'
import { APIPreview } from './APIPreview'

const STEPS = ['personal', 'business', 'product'] as const
const STEP_ROUTES = [
  '/onboarding/personal',
  '/onboarding/business',
  '/onboarding/product',
] as const

interface OnboardingShellProps {
  title: string
  subtitle?: string
  step: 'personal' | 'business' | 'product'
  children: ReactNode
}

export function OnboardingShell({
  title,
  subtitle,
  step,
  children,
}: OnboardingShellProps) {
  const router = useRouter()
  const currentIndex = STEPS.indexOf(step)

  return (
    <Box display="flex" height="100%" minHeight="100vh">
      {/* Left: form */}
      <Box
        backgroundColor="background-primary"
        display="flex"
        flex={1}
        flexDirection="column"
        alignItems="center"
        overflowY="auto"
        paddingHorizontal={{ base: '2xl', md: '4xl', lg: '3xl' }}
        paddingTop="5xl"
        paddingBottom="3xl"
      >
        <motion.div
          key={step}
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
            <Box display="flex" width="100%" alignItems="center" gap="s">
              {STEPS.map((s, i) => (
                <Box key={s} display="flex" flex={1}>
                  <div
                    className={`h-0.5 w-full rounded-full transition-colors ${
                      i <= currentIndex
                        ? 'dark:bg-polar-50 bg-gray-900'
                        : 'dark:bg-polar-700 bg-gray-200'
                    }`}
                  />
                </Box>
              ))}
            </Box>
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
        </motion.div>
      </Box>

      {/* Right: API preview */}
      <Box
        backgroundColor="background-secondary"
        display={{ base: 'none', lg: 'flex' }}
        width="50%"
        maxWidth="36rem"
        flexDirection="column"
        alignItems="center"
        paddingHorizontal="2xl"
        paddingTop="5xl"
        paddingBottom="3xl"
      >
        <Box width="100%" maxWidth="24rem" position="sticky" top={80}>
          <APIPreview step={step} />
        </Box>
      </Box>
    </Box>
  )
}
