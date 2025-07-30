'use client'

import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import { ArrowOutwardOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Package,
  Code2,
  Building2 
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
  integrate_api: <Code2 />,
  setup_account: <Building2 />,
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
    <div className={twMerge('dark:bg-polar-800 rounded-4xl bg-gray-50 p-4 md:p-6', className)}>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
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

        <p className="dark:text-polar-400 text-sm md:text-base text-gray-600">
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
      <div className="relative">
        {paymentStatus.steps.map((step, index) => {
          const isLast = index === paymentStatus.steps.length - 1
          const action = stepActions[step.id as keyof typeof stepActions]
          const icon = stepIcons[step.id as keyof typeof stepIcons] || <Package className="h-5 w-5" />

          return (
            <div key={step.id} className={twMerge("relative", !isLast && "mb-3")}>
              {/* Connector Line */}
              {!isLast && (
                <div className="dark:bg-polar-700 absolute left-[35px] md:left-[39px] top-[70px] md:top-[80px] w-0.5 bg-gray-200 z-0" style={{ height: 'calc(100% + 12px)' }} />
              )}

              <div
                className={twMerge(
                  'relative z-10 flex items-start gap-3 md:gap-4 rounded-3xl border p-3 md:p-4 transition-all duration-200',
                  step.completed
                    ? 'border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-900/10'
                    : 'dark:bg-polar-800/50 dark:border-polar-700 dark:hover:border-polar-600 border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm',
                )}
              >
                {/* Step Icon/Status */}
                <div className="flex-shrink-0">
                  {step.completed ? (
                    <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full border-2 border-green-300 bg-green-100 dark:border-green-700 dark:bg-green-900/30">
                      <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="dark:bg-polar-800 dark:border-polar-600 flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-100">
                      <div className="text-gray-600 dark:text-polar-400">
                        {React.cloneElement(icon, { className: "h-4 w-4 md:h-5 md:w-5" })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Step Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                        {step.title}
                      </h3>
                      <p className="dark:text-polar-400 mt-1 text-sm md:text-base text-gray-600 line-clamp-3 sm:line-clamp-none">
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
                        className="flex-shrink-0 self-start"
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs md:text-sm"
                        >
                          <span className="hidden sm:inline">{action.label}</span>
                          <span className="sm:hidden">Setup</span>
                          <ArrowOutwardOutlined className="!h-3.5 !w-3.5" fontSize="inherit" />
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
        <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/10">
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
    </div>
  )
}

export default PaymentOnboardingStepper
