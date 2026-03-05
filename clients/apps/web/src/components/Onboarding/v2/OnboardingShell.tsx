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
    <div className="dark:bg-polar-950 flex h-full min-h-screen flex-col items-center bg-gray-50 px-4 py-8 md:px-8">
      {/* Logo */}
      <div className="mb-6">
        <LogoIcon size={36} />
      </div>

      {/* Progress steps as API endpoints */}
      <div className="mb-8 flex w-full max-w-5xl items-center gap-2 font-mono text-[11px]">
        {STEPS.map((s, i) => {
          const { method, path } = STEP_ENDPOINTS[i]
          const isActive = i === currentIndex
          const isCompleted = i < currentIndex
          const methodColor =
            method === 'POST'
              ? 'text-green-600 dark:text-green-500'
              : 'text-amber-600 dark:text-amber-500'
          return (
            <div key={s} className="flex flex-1 flex-col gap-1.5">
              <div
                className={`h-1 rounded-full transition-colors ${
                  i <= currentIndex
                    ? 'bg-blue-500'
                    : 'dark:bg-polar-700 bg-gray-200'
                }`}
              />
            </div>
          )
        })}
      </div>

      {/* Card with form + API preview */}
      <div className="flex w-full max-w-5xl flex-1 items-center">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="dark:border-polar-700 dark:bg-polar-900 flex w-full overflow-hidden rounded-3xl border border-gray-200 bg-white"
        >
          {/* Left: form */}
          <div className="flex flex-1 flex-col gap-y-8 overflow-y-auto p-8 md:p-10">
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
          <div className="dark:bg-polar-950 hidden w-[340px] shrink-0 overflow-y-auto bg-gray-50 p-8 lg:block">
            <APIPreview step={step} />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
