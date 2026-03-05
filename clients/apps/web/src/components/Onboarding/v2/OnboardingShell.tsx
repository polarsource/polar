'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import LogoIcon from '../../Brand/logos/LogoIcon'
import { APIPreview } from './APIPreview'

const STEPS = ['personal', 'business', 'product'] as const
const STEP_ENDPOINTS = [
  { method: 'POST', path: '/v1/organizations' },
  { method: 'PATCH', path: '/v1/organizations/:id' },
  { method: 'PATCH', path: '/v1/organizations/:id' },
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
  const currentIndex = STEPS.indexOf(step)

  return (
    <div className="dark:bg-polar-950 flex h-full min-h-screen flex-col items-center bg-white px-4 py-8 md:px-8">
      {/* Logo */}
      <div className="mb-6">
        <LogoIcon size={36} />
      </div>

      {/* Progress steps */}
      <div className="mb-8 flex w-full max-w-4xl items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col gap-1.5">
            <div
              className={`h-0.5 rounded-full transition-colors ${
                i <= currentIndex
                  ? 'dark:bg-polar-50 bg-gray-900'
                  : 'dark:bg-polar-700 bg-gray-200'
              }`}
            />
          </div>
        ))}
      </div>

      {/* Form + API preview */}
      <div className="flex w-full max-w-4xl flex-1 items-center">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex w-full"
        >
          {/* Left: form */}
          <div className="flex flex-1 flex-col gap-y-8 py-4 pr-8 md:pr-12">
            <div className="flex flex-col gap-y-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {title}
              </h1>
              {subtitle && (
                <p className="dark:text-polar-400 text-sm text-gray-500">
                  {subtitle}
                </p>
              )}
            </div>
            {children}
          </div>

          {/* Right: API preview */}
          <div className="dark:border-polar-800 hidden w-[340px] shrink-0 overflow-y-auto border-l border-gray-100 py-4 pl-8 lg:block">
            <APIPreview step={step} />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
