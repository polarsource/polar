'use client'

import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Clock,
  Code2,
  Package,
} from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface PaymentOnboardingStepperProps {
  organization: schemas['Organization']
  className?: string
}

const stepIcons = {
  create_product: <Package />,
  integrate_checkout: <Code2 />,
  setup_account: <Building2 />,
} as const

const stepActions = {
  create_product: {
    href: '/dashboard/[organization]/products/new',
    label: 'Create Product',
  },
  integrate_checkout: {
    href: '/dashboard/[organization]/settings#developers',
    label: 'Get Started',
  },
  setup_account: {
    href: '/dashboard/[organization]/finance/account',
    label: 'Complete Setup',
  },
} as const

const integrationOptions = [
  {
    id: 'api-key',
    title: 'API Integration',
    description: 'Build custom checkout flows with full control',
    href: '/dashboard/[organization]/settings#developers',
    features: ['Full customization', 'Your own UI', 'Advanced features'],
  },
  {
    id: 'checkout-link',
    title: 'Checkout Links',
    description: 'Quick setup with pre-built checkout pages',
    href: '/dashboard/[organization]/products/checkout-links',
    features: ['No coding required', 'Instant setup', 'Share anywhere'],
  },
] as const

export const PaymentOnboardingStepper = ({
  organization,
  className,
}: PaymentOnboardingStepperProps) => {
  const { data: paymentStatus, isLoading } = useOrganizationPaymentStatus(
    organization.id,
  )

  if (isLoading) {
    return (
      <div className={twMerge('animate-pulse space-y-4', className)}>
        <div className="dark:bg-polar-700 h-6 rounded bg-gray-200" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="dark:bg-polar-700 h-16 rounded bg-gray-200"
            />
          ))}
        </div>
      </div>
    )
  }

  if (!paymentStatus) {
    return null
  }

  return (
    <div
      className={twMerge(
        'dark:bg-polar-900 dark:md:bg-polar-800 md:rounded-4xl rounded-2xl bg-gray-50 p-4 md:p-8',
        className,
      )}
    >
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900 md:text-xl dark:text-white">
              Checkout Setup
            </h2>
            {paymentStatus.payment_ready ? (
              <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 md:flex dark:bg-emerald-950">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Ready to Accept Payments
                </span>
              </div>
            ) : (
              <div className="dark:bg-polar-700 hidden w-fit items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm md:flex">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Setup Required</span>
              </div>
            )}
          </div>

          <p className="dark:text-polar-500 text-gray-500">
            Complete these steps to set up checkout and start accepting payments
          </p>
        </div>

        {/* Steps */}
        <div className="relative flex flex-col gap-y-4">
          {paymentStatus.steps.map((step) => {
            const action = stepActions[step.id as keyof typeof stepActions]
            const icon = stepIcons[step.id as keyof typeof stepIcons] || (
              <Package className="h-5 w-5" />
            )

            const hasExpandedContent =
              step.id === 'integrate_checkout' && !step.completed

            return (
              <div key={step.id} className="relative">
                {/* Step Container */}
                <div
                  className={twMerge(
                    'relative flex items-start gap-3 rounded-2xl p-4 shadow-sm transition-all duration-200 md:gap-4 md:rounded-3xl md:p-6',
                    step.completed
                      ? 'dark:border-polar-700 border border-gray-200'
                      : 'dark:md:bg-polar-700 dark:bg-polar-800 bg-white',
                  )}
                >
                  {/* Step Icon */}
                  <div className="flex-shrink-0">
                    {step.completed ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 md:h-12 md:w-12 dark:bg-emerald-950">
                        <CheckCircle className="h-5 w-5 text-emerald-600 md:h-6 md:w-6 dark:text-emerald-400" />
                      </div>
                    ) : (
                      <div className="dark:md:bg-polar-800 dark:bg-polar-700 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 md:h-12 md:w-12">
                        <div className="dark:text-polar-400 text-gray-600">
                          {React.cloneElement(icon, {
                            className: 'h-4 w-4 md:h-5 md:w-5',
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="flex min-w-0 flex-1 flex-col gap-y-4">
                        <div className="flex flex-col gap-y-0">
                          <h3 className="text-base font-semibold text-gray-900 md:text-lg dark:text-white">
                            {step.title}
                          </h3>
                          <p className="dark:text-polar-400 text-sm text-gray-600 md:text-base">
                            {step.description}
                          </p>
                        </div>

                        {/* Expanded Integration Options */}
                        {hasExpandedContent && (
                          <div className="space-y-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                              {integrationOptions.map((option) => (
                                <Link
                                  key={option.id}
                                  href={option.href.replace(
                                    '[organization]',
                                    organization.slug,
                                  )}
                                  className="dark:bg-polar-800 dark:hover:bg-polar-750 flex items-start gap-3 rounded-xl bg-gray-100 p-4 transition-colors hover:bg-gray-50"
                                >
                                  <div className="flex min-w-0 flex-1 flex-col gap-y-1">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                      {option.title}
                                    </h4>
                                    <p className="dark:text-polar-400 text-xs text-gray-600">
                                      {option.description}
                                    </p>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      {!step.completed && action && !hasExpandedContent && (
                        <Link
                          href={action.href.replace(
                            '[organization]',
                            organization.slug,
                          )}
                          className="flex-shrink-0 self-start"
                        >
                          <Button size="sm" variant="secondary">
                            {action.label}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Status Warning */}
        {!paymentStatus.payment_ready && (
          <div className="dark:bg-polar-800 dark:md:bg-polar-700 flex items-start gap-3 rounded-2xl bg-gray-200 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div className="flex flex-col gap-y-1 text-sm">
              <p className="font-medium">
                Payment processing is not yet available
              </p>
              <p className="dark:text-polar-500 text-gray-500">
                Complete all steps above to start accepting payments from
                customers
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PaymentOnboardingStepper
