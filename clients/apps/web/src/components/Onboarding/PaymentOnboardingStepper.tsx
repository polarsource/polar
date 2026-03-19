'use client'

import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  AlertCircle,
  Building2,
  Code2,
  ConstructionIcon,
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

const PaymentOnboardingStepper = ({
  organization,
  className,
}: PaymentOnboardingStepperProps) => {
  const { data: paymentStatus, isLoading } = useOrganizationPaymentStatus(
    organization.id,
  )

  if (isLoading) {
    return (
      <div className={twMerge('animate-pulse space-y-4', className)}>
        <div className="dark:bg-polar-700 h-6 rounded-sm bg-gray-200" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="dark:bg-polar-700 h-16 rounded-sm bg-gray-200"
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
    <div className={twMerge('flex flex-col gap-6', className)}>
      {/* Status Warning */}
      {!paymentStatus.payment_ready && (
        <div className="rounded-2xl bg-yellow-100 p-4 dark:bg-yellow-950">
          <div className="flex items-start gap-3">
            <ConstructionIcon className="h-5 w-5 shrink-0 text-yellow-800 dark:text-yellow-500" />
            <div className="flex flex-col gap-y-1 text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-500">
                Your account is in test mode
              </p>
              <p className="max-w-md text-yellow-700 dark:text-yellow-600">
                Set up your products and integrate into your app. Test the full
                flow with 100% discount codes. When you&rsquo;re ready, go live
                to start accepting payments from your customers.
              </p>
              <div className="pt-2">
                <Link href={`/dashboard/${organization.slug}/finance/account`}>
                  <Button>Go live</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-4 md:space-y-6">
        {/* Steps */}
        <div className="relative grid grid-cols-1 divide-x-0 divide-y divide-gray-100 rounded-3xl border border-gray-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0 dark:divide-white/5 dark:border-white/5">
          {[paymentStatus.steps[0], paymentStatus.steps[1]].map((step) => {
            const action = stepActions[step.id as keyof typeof stepActions]
            const icon = stepIcons[step.id as keyof typeof stepIcons] || (
              <Package className="h-5 w-5" />
            )

            const hasExpandedContent =
              step.id === 'integrate_checkout' && !step.completed

            return (
              <div
                key={step.id}
                className="relative flex flex-col gap-6 p-6 md:p-8 lg:p-10"
              >
                {/* Step Icon */}
                <div className="shrink-0">
                  {step.completed ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                      {React.cloneElement(icon, {
                        className:
                          'h-4 w-4 md:h-5 md:w-5 dark:text-emerald-400 text-emerald-600',
                      })}
                    </div>
                  ) : (
                    <div className="dark:bg-polar-700 flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-gray-100 md:h-12 md:w-12 dark:border-white/5">
                      <div className="text-black dark:text-white">
                        {React.cloneElement(icon, {
                          className: 'h-4 w-4 md:h-5 md:w-5',
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Step Content */}
                <div className="flex flex-1 flex-col justify-between gap-6">
                  <div className="flex flex-1 flex-col gap-y-8">
                    <div className="flex flex-col gap-y-2">
                      <h3 className="text-lg text-gray-900 md:text-xl dark:text-white">
                        {step.title}
                      </h3>
                      <p className="dark:text-polar-400 text-sm text-gray-600 md:text-base">
                        {step.description}
                      </p>
                    </div>

                    {/* Expanded Integration Options */}
                    {hasExpandedContent && (
                      <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                          {integrationOptions.map((option) => (
                            <Link
                              key={option.id}
                              href={option.href.replace(
                                '[organization]',
                                organization.slug,
                              )}
                              className="dark:bg-polar-700 dark:hover:bg-polar-700 flex items-start gap-3 rounded-xl bg-gray-100 p-4 transition-all hover:bg-gray-50 dark:hover:opacity-50"
                            >
                              <div className="flex min-w-0 flex-1 flex-col gap-y-1">
                                <div className="flex flex-row items-center">
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                    {option.title}
                                  </h4>

                                  <ArrowOutwardOutlined
                                    className="ml-2"
                                    fontSize="inherit"
                                  />
                                </div>
                                <p className="dark:text-polar-400 text-sm text-gray-600">
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
                    >
                      <Button className="w-full">{action.label}</Button>
                    </Link>
                  )}
                  {step.completed && (
                    <Button className="w-full" variant="secondary" disabled>
                      Completed
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default PaymentOnboardingStepper
