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
    <div className="flex h-full min-h-screen">
      {/* Left: form */}
      <div className="dark:bg-polar-950 flex flex-1 flex-col items-center justify-center bg-white px-8 py-12 md:px-16 lg:px-24">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex w-full max-w-md flex-col gap-y-8"
        >
          {/* Logo + progress */}
          <div className="flex flex-col gap-y-6">
            <LogoIcon size={36} />
            <div className="flex w-full items-center gap-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex flex-1">
                  <div
                    className={`h-0.5 w-full rounded-full transition-colors ${
                      i <= currentIndex
                        ? 'dark:bg-polar-50 bg-gray-900'
                        : 'dark:bg-polar-700 bg-gray-200'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

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
        </motion.div>
      </div>

      {/* Right: API preview */}
      <div className="dark:bg-polar-900 hidden w-1/2 max-w-xl flex-col items-center justify-center bg-gray-50 px-12 py-12 lg:flex">
        <div className="w-full max-w-sm">
          <APIPreview step={step} />
        </div>
      </div>
    </div>
  )
}
