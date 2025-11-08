'use client'

import AIValidationResult from '@/components/Organization/AIValidationResult'
import OrganizationProfileSettings from '@/components/Settings/OrganizationProfileSettings'
import { schemas } from '@polar-sh/client'
import {
  Check,
  CheckCircle,
  Clock,
  Shield,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react'
import React, { useState } from 'react'
import AccountStep from './Steps/AccountStep'
import IdentityStep from './Steps/IdentityStep'

type Step = 'review' | 'validation' | 'account' | 'identity' | 'complete'

type StepStatus =
  | 'pending'
  | 'current'
  | 'completed'
  | 'blocked'
  | 'in_progress'
  | 'failed'

interface StepConfig {
  id: Step
  title: string
  description: string
  icon: React.ReactNode
  status: StepStatus
}

interface StreamlinedAccountReviewProps {
  organization: schemas['Organization']
  currentStep: Step
  requireDetails: boolean
  organizationAccount?: schemas['Account']
  identityVerified?: boolean
  identityVerificationStatus?: string
  organizationReviewStatus?: schemas['OrganizationReviewStatus']
  isNotAdmin?: boolean
  onDetailsSubmitted: () => void
  onValidationCompleted: () => void
  onStartAccountSetup: () => void
  onStartIdentityVerification: () => void
  onSkipAccountSetup?: () => void
  onAppealApproved?: () => void
  onAppealSubmitted?: () => void
  onNavigateToStep?: (step: Step) => void
}

const ProgressIndicator = ({
  steps,
  onStepClick,
  organizationReviewStatus,
  isReviewCompleted,
  isValidationCompleted,
  isAccountCompleted,
  isNotAdmin,
  isAppealSubmitted,
}: {
  steps: StepConfig[]
  onStepClick?: (stepId: Step) => void
  organizationReviewStatus?: schemas['OrganizationReviewStatus']
  isReviewCompleted: boolean
  isValidationCompleted: boolean
  isAccountCompleted: boolean
  isNotAdmin: boolean
  isAppealSubmitted: boolean
}) => {
  // Calculate progress based on completed steps
  const calculateProgress = () => {
    if (steps.length <= 1) {
      return 0
    }

    const currentStepIndex = steps.findIndex(
      (step) =>
        step.status === 'current' ||
        step.status === 'in_progress' ||
        step.status === 'failed',
    )

    // If no step is current, it means all are completed or pending
    if (currentStepIndex === -1) {
      const allCompleted = steps.every((step) => step.status === 'completed')
      return allCompleted ? 100 : 0
    }

    // Calculate percentage based on the segments between steps
    return (currentStepIndex / (steps.length - 1)) * 100
  }

  return (
    <div className="relative">
      {/* Progress bar background */}
      <div className="dark:bg-polar-700 absolute top-6 right-6 left-6 h-0.5 bg-gray-200" />

      {/* Progress bar fill */}
      <div
        className="dark:bg-polar-400 absolute top-6 left-6 h-0.5 bg-gray-500 transition-all duration-500 ease-out"
        style={{
          width: `calc(${calculateProgress()}% - 24px)`,
        }}
      />

      <div className="flex items-center justify-between">
        {steps.map((step) => {
          const isCompleted = step.status === 'completed'
          const isCurrent = step.status === 'current'
          const isBlocked = step.status === 'blocked'
          const isPending = step.status === 'in_progress'
          const isFailed = step.status === 'failed'

          const isClickable =
            onStepClick &&
            ((step.id === 'review' && isReviewCompleted) ||
              (step.id === 'validation' &&
                isReviewCompleted &&
                organizationReviewStatus) ||
              (step.id === 'account' &&
                (isValidationCompleted || isAppealSubmitted || isNotAdmin)) ||
              (step.id === 'identity' && isAccountCompleted))

          return (
            <div key={step.id} className="relative flex flex-col items-center">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  isCompleted
                    ? 'dark:bg-polar-400 dark:text-polar-950 dark:border-polar-400 border-gray-500 bg-gray-500 text-white'
                    : isPending
                      ? 'border-blue-500 bg-blue-400 text-white'
                      : isFailed
                        ? 'border-red-500 bg-red-500 text-white'
                        : isCurrent
                          ? 'border-blue-500 bg-blue-400 text-white'
                          : isBlocked
                            ? 'dark:bg-polar-800 dark:border-polar-600 border-gray-300 bg-gray-100 text-gray-400'
                            : 'dark:bg-polar-900 dark:border-polar-600 border-gray-300 bg-white text-gray-400'
                } ${isClickable ? 'cursor-pointer hover:border-gray-400 hover:bg-gray-400' : ''}`}
                onClick={() => isClickable && onStepClick(step.id)}
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
                      ? 'dark:text-polar-300 text-gray-600'
                      : isPending
                        ? 'dark:text-polar-300 text-gray-600'
                        : isFailed
                          ? 'text-red-600 dark:text-red-400'
                          : isCurrent
                            ? 'dark:text-polar-300 text-gray-600'
                            : 'dark:text-polar-400 text-gray-500'
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

export default function StreamlinedAccountReview({
  organization,
  currentStep,
  requireDetails,
  organizationAccount,
  identityVerified,
  identityVerificationStatus,
  organizationReviewStatus,
  isNotAdmin = false,
  onDetailsSubmitted,
  onValidationCompleted,
  onStartAccountSetup,
  onStartIdentityVerification,
  onSkipAccountSetup,
  onAppealApproved,
  onAppealSubmitted,
  onNavigateToStep,
}: StreamlinedAccountReviewProps) {
  const [validationCompleted, setValidationCompleted] = useState(false)

  const handleDetailsSubmitted = () => {
    onDetailsSubmitted()
  }

  const handleValidationCompleted = () => {
    setValidationCompleted(true)
    onValidationCompleted()
  }

  const handleStepClick = (stepId: Step) => {
    if (onNavigateToStep) {
      onNavigateToStep(stepId)
    }
  }

  const getValidationIcon = () => {
    console.log('organizationReviewStatus', organizationReviewStatus)
    if (!organizationReviewStatus) {
      return <ShieldCheck className="h-5 w-5" />
    }

    // AI validation passed
    if (organizationReviewStatus.verdict === 'PASS') {
      return <CheckCircle className="h-5 w-5" />
    }

    // Appeal approved
    if (organizationReviewStatus.appeal_decision === 'approved') {
      return <CheckCircle className="h-5 w-5" />
    }

    // Appeal denied
    if (organizationReviewStatus.appeal_decision === 'rejected') {
      return <XCircle className="h-5 w-5" />
    }

    // Appeal under review
    if (
      organizationReviewStatus.appeal_submitted_at &&
      !organizationReviewStatus.appeal_decision
    ) {
      return <Clock className="h-5 w-5" />
    }

    // AI validation failed (no appeal submitted)
    if (
      organizationReviewStatus.verdict === 'FAIL' ||
      organizationReviewStatus.verdict === 'UNCERTAIN'
    ) {
      return <XCircle className="h-5 w-5" />
    }

    return <ShieldCheck className="h-5 w-5" />
  }

  // Determine completion status for each step
  const isReviewCompleted = organization.details_submitted_at !== null

  // Check if validation is completed through AI result PASS or approved appeal
  const isAIValidationPassed = organizationReviewStatus?.verdict === 'PASS'
  const isAppealApproved =
    organizationReviewStatus?.appeal_decision === 'approved'
  const isAppealSubmitted = organizationReviewStatus?.appeal_submitted_at
  const isValidationCompleted =
    validationCompleted || isAIValidationPassed || isAppealApproved
  const isAccountCompleted =
    (organizationAccount !== undefined &&
      organizationAccount.is_details_submitted) ||
    isNotAdmin // Non-admins skip account setup, so consider it "completed"
  const isIdentityCompleted = !!identityVerified

  const getStepStatus = (
    stepId: Step,
    isCompleted: boolean,
    currentStep: Step,
    prerequisiteCompleted?: boolean,
  ): StepStatus => {
    if (stepId === 'account' && isNotAdmin) {
      return currentStep === 'account' ? 'blocked' : 'completed'
    }

    if (isCompleted) return 'completed'
    if (prerequisiteCompleted !== undefined && !prerequisiteCompleted)
      return 'blocked'

    if (currentStep === stepId) {
      if (stepId === 'identity') {
        if (identityVerificationStatus === 'pending') {
          return 'in_progress'
        } else if (identityVerificationStatus === 'failed') {
          return 'failed'
        }
      }
      if (stepId === 'validation') {
        // Handle validation step status based on AI validation and appeal status
        if (organizationReviewStatus?.verdict === 'PASS') {
          return 'completed'
        } else if (
          organizationReviewStatus?.verdict === 'FAIL' ||
          organizationReviewStatus?.verdict === 'UNCERTAIN'
        ) {
          if (organizationReviewStatus?.appeal_decision === 'approved') {
            return 'completed'
          } else if (organizationReviewStatus?.appeal_decision === 'rejected') {
            return 'failed'
          } else if (organizationReviewStatus?.appeal_submitted_at) {
            return 'in_progress'
          }
          return 'failed'
        }
      }
      return 'current'
    }

    // Special handling for validation step when not current
    if (stepId === 'validation' && organizationReviewStatus) {
      if (
        organizationReviewStatus.verdict === 'PASS' ||
        organizationReviewStatus.appeal_decision === 'approved'
      ) {
        return 'completed'
      } else if (organizationReviewStatus.appeal_decision === 'rejected') {
        return 'failed'
      } else if (organizationReviewStatus.appeal_submitted_at) {
        return 'in_progress'
      } else if (
        organizationReviewStatus.verdict === 'FAIL' ||
        organizationReviewStatus.verdict === 'UNCERTAIN'
      ) {
        return 'failed'
      }
    }

    return 'pending'
  }

  const validationStepStatus = getStepStatus(
    'validation',
    isValidationCompleted,
    currentStep,
    isReviewCompleted,
  )

  const steps: StepConfig[] = [
    {
      id: 'review' as Step,
      title: 'Review',
      description: 'Details & compliance',
      icon: <Shield className="h-5 w-5" />,
      status: getStepStatus('review', isReviewCompleted, currentStep),
    },
    {
      id: 'validation' as Step,
      title: 'Validation',
      description: 'Compliance check',
      icon: getValidationIcon(),
      status: validationStepStatus,
    },
    {
      id: 'account' as Step,
      title: 'Account',
      description: isNotAdmin ? 'Admin only' : 'Payout setup',
      icon: <UserCheck className="h-5 w-5" />,
      status: getStepStatus(
        'account',
        isAccountCompleted,
        currentStep,
        isValidationCompleted || !!isAppealSubmitted,
      ),
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
      status: getStepStatus(
        'identity',
        isIdentityCompleted,
        currentStep,
        isAccountCompleted,
      ),
    },
  ]

  const currentStepConfig = steps.find((s) => s.id === currentStep)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Set up your payout account</h1>
        <p className="dark:text-polar-400 text-gray-600">
          Complete these steps to start accepting payments
        </p>
      </div>

      {/* Progress indicator */}
      <div className="px-8">
        <ProgressIndicator
          steps={steps}
          onStepClick={handleStepClick}
          organizationReviewStatus={organizationReviewStatus}
          isReviewCompleted={isReviewCompleted}
          isValidationCompleted={isValidationCompleted}
          isAccountCompleted={isAccountCompleted}
          isNotAdmin={isNotAdmin}
          isAppealSubmitted={!!isAppealSubmitted}
        />
      </div>

      {/* Current step content */}
      <div className="space-y-6">
        {currentStep === 'review' && (
          <div className="space-y-8">
            {/* Header */}
            <div className="space-y-3 text-center">
              <div className="flex items-center justify-center space-x-3">
                <h1 className="text-2xl font-semibold">Organization Details</h1>
              </div>
              <p className="dark:text-polar-400 mx-auto max-w-2xl text-lg text-gray-600">
                {requireDetails
                  ? "Tell us about your organization so we can review if it's an acceptable use case for Polar."
                  : 'Review your submitted organization details below.'}
              </p>
            </div>

            {requireDetails ? (
              /* Use the consolidated OrganizationProfileSettings with KYC mode */
              <OrganizationProfileSettings
                organization={organization}
                kyc={true}
                onSubmitted={handleDetailsSubmitted}
              />
            ) : (
              /* Show disabled form for viewing all submitted information */
              <div className="flex justify-center">
                <div className="pointer-events-none w-full max-w-2xl opacity-75">
                  <OrganizationProfileSettings
                    organization={organization}
                    kyc={true}
                    onSubmitted={() => {}} // No-op since it's disabled
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 'validation' && (
          <div className="space-y-8">
            {/* Header */}
            <div className="space-y-3 text-center">
              <div className="flex items-center justify-center space-x-3">
                <h1 className="text-2xl font-semibold">Compliance Check</h1>
              </div>
              <p className="dark:text-polar-400 mx-auto max-w-2xl text-lg text-gray-600">
                {organizationReviewStatus?.verdict
                  ? 'Review your validation results and appeal status below.'
                  : 'Our AI is reviewing your organization details against our acceptable use policy.'}
              </p>
            </div>

            {/* AI Validation Results */}
            <AIValidationResult
              organization={organization}
              onValidationCompleted={handleValidationCompleted}
              onAppealApproved={onAppealApproved}
              onAppealSubmitted={onAppealSubmitted}
            />
          </div>
        )}

        {currentStep === 'account' && (
          <AccountStep
            organizationAccount={organizationAccount}
            isNotAdmin={isNotAdmin}
            onStartAccountSetup={onStartAccountSetup}
            onSkipAccountSetup={onSkipAccountSetup}
          />
        )}

        {currentStep === 'identity' && (
          <IdentityStep
            identityVerificationStatus={identityVerificationStatus}
            onStartIdentityVerification={onStartIdentityVerification}
          />
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
