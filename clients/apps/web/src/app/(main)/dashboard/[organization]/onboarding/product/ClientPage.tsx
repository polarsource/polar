'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'

import { FadeUp } from '@/components/Animated/FadeUp'
import LogoIcon from '@/components/Brand/LogoIcon'
import { AssistantStep } from '@/components/Onboarding/AssistantStep'
import { ProductStep } from '@/components/Onboarding/ProductStep'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { twMerge } from 'tailwind-merge'

export default function ClientPage({
  isAssistantEnabled,
}: {
  isAssistantEnabled: boolean
}) {
  const { organization, organizations } = useContext(OrganizationContext)
  const [mode, setMode] = useState<'assistant' | 'manual'>(
    isAssistantEnabled ? 'assistant' : 'manual',
  )
  const [isAssistantFinished, setIsAssistantFinished] = useState(false)
  const [shouldShowSkip, setShouldShowSkip] = useState(organizations.length > 1)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isAssistantFinished) {
        setShouldShowSkip(true)
      }
    }, 4000)

    return () => clearTimeout(timer)
  }, [isAssistantFinished])

  return (
    <div className="dark:md:bg-polar-950 flex flex-col pt-16 md:items-center md:p-16">
      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ duration: 1, staggerChildren: 0.3 }}
        className="flex min-h-0 w-full shrink-0 flex-col gap-12 md:max-w-xl md:p-8"
      >
        <FadeUp className="flex flex-col items-center gap-y-8">
          <LogoIcon size={50} />
          <div className="flex flex-col gap-y-4">
            <h1 className="text-center text-3xl">Your first product</h1>
            <p className="dark:text-polar-400 text-center text-lg text-gray-600">
              Setup your first digital product to get started.
            </p>
          </div>
        </FadeUp>

        {mode === 'assistant' && (
          <AssistantStep
            onEjectToManual={() => setMode('manual')}
            onFinished={() => {
              setShouldShowSkip(false)
              setIsAssistantFinished(true)
            }}
          />
        )}

        {mode === 'manual' && (
          <motion.div
            initial="hidden"
            animate="visible"
            transition={{ duration: 1, staggerChildren: 0.3 }}
            className="flex flex-col gap-12"
          >
            <ProductStep />
          </motion.div>
        )}

        <FadeUp
          className={twMerge(
            'flex flex-col gap-y-2 p-8 transition-opacity duration-1000 ease-out md:p-0',
            shouldShowSkip
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0',
            organizations.length === 1 && !shouldShowSkip ? 'opacity-0!' : '',
          )}
        >
          <div className="dark:text-polar-500 flex flex-row items-center justify-center gap-x-4 text-sm text-gray-500">
            {mode === 'assistant' && (
              <>
                <button
                  className="dark:hover:text-polar-500 dark:hover:bg-polar-700 cursor-pointer rounded-full px-2.5 py-1 transition-colors duration-100 hover:bg-gray-100 hover:text-gray-500"
                  onClick={() => setMode('manual')}
                >
                  Configure manually
                </button>
                ·
              </>
            )}
            <Link
              href={`/dashboard/${organization.slug}`}
              className="dark:hover:text-polar-500 dark:hover:bg-polar-700 rounded-full px-2.5 py-1 transition-colors duration-100 hover:bg-gray-100 hover:text-gray-500"
            >
              Skip onboarding
            </Link>
          </div>
        </FadeUp>
      </motion.div>
    </div>
  )
}
