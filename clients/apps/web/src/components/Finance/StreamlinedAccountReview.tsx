'use client'

import OrganizationProfileSettings from '@/components/Settings/OrganizationProfileSettings'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Card } from '@polar-sh/ui/components/ui/card'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { ArrowRight, Check, CheckCircle, Shield, UserCheck } from 'lucide-react'
import React from 'react'

type Step = 'review' | 'account' | 'identity' | 'complete'

interface StepConfig {
  id: Step
  title: string
  description: string
  icon: React.ReactNode
  status: 'pending' | 'current' | 'completed' | 'blocked'
}

interface StreamlinedAccountReviewProps {
  organization: schemas['Organization']
  currentStep: Step
  requireDetails: boolean
  organizationAccount?: any
  identityVerified?: boolean
  identityVerificationStatus?: string
  onDetailsSubmitted: () => void
  onStartAccountSetup: () => void
  onStartIdentityVerification: () => void
}

const ProgressIndicator = ({
  steps,
  identityVerificationStatus,
}: {
  steps: StepConfig[]
  identityVerificationStatus?: string
}) => {
  // Calculate progress based on completed steps
  const calculateProgress = () => {
    const completedSteps = steps.filter((s) => s.status === 'completed').length
    const identityStep = steps.find((s) => s.id === 'identity')
    const identityIndex = steps.findIndex((s) => s.id === 'identity')
    const detailsStepCompleted = steps.find(
      (s) => s.id === 'review' && s.status === 'completed',
    )

    if (!detailsStepCompleted) {
      return 0
    }

    // If identity is pending, progress should go TO the identity step
    if (
      detailsStepCompleted &&
      identityStep?.status === 'current' &&
      identityVerificationStatus === 'pending'
    ) {
      // Progress goes to the identity step (index 2), so (2 / 2) * 100 = 100%
      return Math.max(0, (identityIndex / (steps.length - 1)) * 100)
    }

    // Normal progress based on completed steps
    return Math.max(0, (completedSteps / (steps.length - 1)) * 100)
  }

  return (
    <div className="relative">
      {/* Progress bar background */}
      <div className="absolute left-6 right-6 top-6 h-0.5 bg-gray-200 dark:bg-gray-700" />

      {/* Progress bar fill */}
      <div
        className="absolute left-6 top-6 h-0.5 bg-blue-500 transition-all duration-500 ease-out"
        style={{
          width: `${calculateProgress()}%`,
          maxWidth: 'calc(100% - 48px)', // Don't extend beyond the step circles
        }}
      />

      <div className="flex items-center justify-between">
        {steps.map((step) => {
          const isCompleted = step.status === 'completed'
          const isCurrent = step.status === 'current'
          const isBlocked = step.status === 'blocked'
          const isPending =
            step.id === 'identity' &&
            identityVerificationStatus === 'pending' &&
            isCurrent
          const isFailed =
            step.id === 'identity' &&
            identityVerificationStatus === 'failed' &&
            isCurrent

          return (
            <div key={step.id} className="relative flex flex-col items-center">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  isCompleted
                    ? 'border-green-500 bg-green-500 text-white'
                    : isPending
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : isFailed
                        ? 'border-red-500 bg-red-500 text-white'
                        : isCurrent
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : isBlocked
                            ? 'border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-600 dark:bg-gray-800'
                            : 'border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-900'
                } `}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : isPending ? (
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : isFailed ? (
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <div className="text-sm font-medium">{step.icon}</div>
                )}
              </div>

              <div className="mt-3 max-w-24 text-center">
                <p
                  className={`text-xs font-medium ${
                    isCompleted
                      ? 'text-green-600 dark:text-green-400'
                      : isPending
                        ? 'text-blue-600 dark:text-blue-400'
                        : isFailed
                          ? 'text-red-600 dark:text-red-400'
                          : isCurrent
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step.title}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const StepCard = ({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) => <Card className={`p-6 ${className}`}>{children}</Card>

export default function StreamlinedAccountReview({
  organization,
  currentStep,
  requireDetails,
  organizationAccount,
  identityVerified,
  identityVerificationStatus,
  onDetailsSubmitted,
  onStartAccountSetup,
  onStartIdentityVerification,
}: StreamlinedAccountReviewProps) {
  // Determine completion status for each step
  const isReviewCompleted = !!organization.details_submitted_at
  const isAccountCompleted = !!organizationAccount
  const isIdentityCompleted = !!identityVerified

  const steps: StepConfig[] = [
    {
      id: 'review' as Step,
      title: 'Review',
      description: 'Details & compliance',
      icon: <Shield className="h-5 w-5" />,
      status: isReviewCompleted
        ? 'completed'
        : currentStep === 'review'
          ? 'current'
          : 'pending',
    },
    {
      id: 'account' as Step,
      title: 'Account',
      description: 'Payout setup',
      icon: <UserCheck className="h-5 w-5" />,
      status: isAccountCompleted
        ? 'completed'
        : !isReviewCompleted
          ? 'blocked'
          : currentStep === 'account'
            ? 'current'
            : 'pending',
    },
    {
      id: 'identity' as Step,
      title: 'Identity',
      description:
        identityVerificationStatus === 'pending'
          ? 'Processing...'
          : identityVerificationStatus === 'failed'
            ? 'Failed'
            : 'Verification',
      icon: <CheckCircle className="h-5 w-5" />,
      status: isIdentityCompleted
        ? 'completed'
        : !isAccountCompleted
          ? 'blocked'
          : currentStep === 'identity'
            ? 'current'
            : 'pending',
    },
  ]

  const currentStepConfig = steps.find((s) => s.id === currentStep)

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Set up your payout account</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Complete these steps to start accepting payments
        </p>
      </div>

      {/* Progress indicator */}
      <div className="px-8">
        <ProgressIndicator
          steps={steps}
          identityVerificationStatus={identityVerificationStatus}
        />
      </div>

      {/* Current step content */}
      <div className="space-y-6">
        {currentStep === 'review' && requireDetails && (
          <div className="mx-auto max-w-4xl space-y-8">
            {/* Header */}
            <div className="space-y-3 text-center">
              <div className="flex items-center justify-center space-x-3">
                <h1 className="text-2xl font-semibold">Organization Details</h1>
              </div>
              <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
                Tell us about your organization so we can review if it&apos;s an
                acceptable use case for Polar.
              </p>
            </div>

            {/* Use the consolidated OrganizationProfileSettings with KYC mode */}
            <OrganizationProfileSettings
              organization={organization}
              kyc={true}
              onSubmitted={onDetailsSubmitted}
            />
          </div>
        )}

        {currentStep === 'account' && (
          <StepCard>
            <div className="space-y-4">
              <Separator className="my-6" />
              <div className="space-y-4 text-center">
                <div className="rounded-lg bg-gray-50 p-8 dark:bg-gray-800">
                  <h4 className="mb-2 font-medium">Create Payout Account</h4>
                  <p className="mx-auto mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
                    Connect or create a Stripe account to receive payments from
                    your customers.
                  </p>
                  <Button onClick={onStartAccountSetup} className="w-auto">
                    Continue with Account Setup
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </StepCard>
        )}

        {currentStep === 'identity' && (
          <StepCard>
            <div className="space-y-4">
              <div className="space-y-4 text-center">
                <div className="rounded-lg bg-gray-50 p-8 dark:bg-gray-800">
                  {identityVerificationStatus === 'pending' ? (
                    <>
                      <div className="mb-4 flex justify-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                          <svg
                            className="h-4 w-4 text-blue-600 dark:text-blue-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                      <h4 className="mb-2 font-medium text-blue-600 dark:text-blue-400">
                        Identity Verification Pending
                      </h4>
                      <p className="mx-auto mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
                        Your identity verification is being processed. This
                        usually takes a few minutes but can take up to 24 hours.
                      </p>
                      <div className="text-xs text-gray-500">
                        We&apos;ll notify you once verification is complete.
                      </div>
                    </>
                  ) : identityVerificationStatus === 'verified' ? (
                    <>
                      <div className="mb-4 flex justify-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <h4 className="mb-2 font-medium text-green-600 dark:text-green-400">
                        Identity Verified
                      </h4>
                      <p className="mx-auto text-sm text-gray-600 dark:text-gray-400">
                        Your identity has been successfully verified.
                      </p>
                    </>
                  ) : identityVerificationStatus === 'failed' ? (
                    <>
                      <div className="mb-4 flex justify-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                          <svg
                            className="h-4 w-4 text-red-600 dark:text-red-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                      <h4 className="mb-2 font-medium text-red-600 dark:text-red-400">
                        Identity Verification Failed
                      </h4>
                      <p className="mx-auto mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
                        We were unable to verify your identity. This could be
                        due to document quality or information mismatch. Please
                        try again.
                      </p>
                      <Button
                        onClick={onStartIdentityVerification}
                        className="w-auto"
                        variant="destructive"
                      >
                        Try Again
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="mb-4 flex justify-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                          <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <h4 className="mb-2 font-medium">Verify Your Identity</h4>
                      <p className="mx-auto mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
                        To comply with financial regulations and secure your
                        account, we need to verify your identity using a
                        government-issued ID.
                      </p>
                      <Button
                        onClick={onStartIdentityVerification}
                        className="w-auto"
                      >
                        Start Identity Verification
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </StepCard>
        )}
      </div>

      {/* Status footer */}
      {currentStepConfig && (
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Step {steps.findIndex((s) => s.id === currentStep) + 1} of{' '}
            {steps.length}: {currentStepConfig.description}
          </p>
        </div>
      )}
    </div>
  )
}
