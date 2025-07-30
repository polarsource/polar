'use client'

import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { AlertCircle, CheckCircle, Clock, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

interface PaymentOnboardingStepperProps {
  organization: schemas['Organization']
  className?: string
}

const stepIcons = {
  create_product: '📦',
  integrate_api: '🔌',
  setup_account: '🏦',
} as const

const stepActions = {
  create_product: {
    href: '/dashboard/[organization]/products/new',
    label: 'Create Product',
  },
  integrate_api: {
    href: '/dashboard/[organization]/settings#developers',
    label: 'Create API Key',
  },
  setup_account: {
    href: '/dashboard/[organization]/finance/account',
    label: 'Complete Setup',
  },
} as const

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

  const completedSteps = paymentStatus.steps.filter(
    (step) => step.completed,
  ).length
  const progressPercentage = (completedSteps / paymentStatus.steps.length) * 100

  return (
    <div className={twMerge('space-y-6', className)}>
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Payment Setup
          </h2>
          {paymentStatus.payment_ready ? (
            <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 dark:border-green-800 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Ready to Accept Payments
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 dark:border-amber-800 dark:bg-amber-900/20">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Setup Required
              </span>
            </div>
          )}
        </div>

        <p className="dark:text-polar-400 text-gray-600">
          Complete these steps to start accepting payments on your organization.
        </p>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="dark:text-polar-400 text-gray-600">Progress</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {completedSteps}/{paymentStatus.steps.length} completed
            </span>
          </div>
          <div className="dark:bg-polar-700 h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {paymentStatus.steps.map((step, index) => {
          const isLast = index === paymentStatus.steps.length - 1
          const action = stepActions[step.id as keyof typeof stepActions]
          const icon = stepIcons[step.id as keyof typeof stepIcons] || '📋'

          return (
            <div key={step.id} className="relative">
              {/* Connector Line */}
              {!isLast && (
                <div className="dark:bg-polar-700 absolute bottom-0 left-6 top-12 w-0.5 bg-gray-200" />
              )}

              <div
                className={twMerge(
                  'flex items-start gap-4 rounded-xl border p-4 transition-all duration-200',
                  step.completed
                    ? 'border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-900/10'
                    : 'dark:bg-polar-900 dark:border-polar-700 dark:hover:border-polar-600 border-gray-200 bg-white hover:border-gray-300',
                )}
              >
                {/* Step Icon/Status */}
                <div className="flex-shrink-0">
                  {step.completed ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-300 bg-green-100 dark:border-green-700 dark:bg-green-900/30">
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="dark:bg-polar-800 dark:border-polar-600 flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-100 text-xl">
                      {icon}
                    </div>
                  )}
                </div>

                {/* Step Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {step.title}
                      </h3>
                      <p className="dark:text-polar-400 mt-1 text-sm text-gray-600">
                        {step.description}
                      </p>
                    </div>

                    {/* Action Button */}
                    {!step.completed && action && (
                      <Link
                        href={action.href.replace(
                          '[organization]',
                          organization.slug,
                        )}
                        className="flex-shrink-0"
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          className="inline-flex items-center gap-2"
                        >
                          {action.label}
                          <ExternalLink className="h-3 w-3" />
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
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/10">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              Payment processing is not yet available
            </p>
            <p className="mt-1 text-amber-700 dark:text-amber-400">
              Complete all steps above to start accepting payments from
              customers.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentOnboardingStepper
