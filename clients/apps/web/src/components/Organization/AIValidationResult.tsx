'use client'

import {
  useOrganizationAIValidation,
  useOrganizationReviewStatus,
} from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Card } from '@polar-sh/ui/components/ui/card'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Info,
  Loader2,
} from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import AppealForm from './AppealForm'

interface AIValidationResultProps {
  organization: schemas['Organization']
  onValidationCompleted?: () => void
  onAppealApproved?: () => void
  onAppealSubmitted?: () => void
}

const AIValidationResult: React.FC<AIValidationResultProps> = ({
  organization,
  onValidationCompleted,
  onAppealApproved,
  onAppealSubmitted,
}) => {
  const hasAutoValidatedRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [stopPolling, setStopPolling] = useState(false)

  const aiValidation = useOrganizationAIValidation(organization.id)
  const shouldPoll = useMemo(
    () => !timedOut && !stopPolling,
    [timedOut, stopPolling],
  )
  const reviewStatus = useOrganizationReviewStatus(
    organization.id,
    true,
    shouldPoll ? 2000 : undefined,
  )

  // Auto-validate when component mounts
  useEffect(() => {
    if (!hasAutoValidatedRef.current && !aiValidation.isPending) {
      hasAutoValidatedRef.current = true
      startedAtRef.current = Date.now()
      aiValidation.mutate()
    }
  }, [aiValidation])

  // Timeout after ~25s and stop polling
  useEffect(() => {
    if (timedOut) return
    const started = startedAtRef.current
    if (started == null) return
    const timeout = setTimeout(() => setTimedOut(true), 25_000)
    return () => clearTimeout(timeout)
  }, [timedOut])

  // Stop polling once a verdict is present
  useEffect(() => {
    if (reviewStatus.data?.verdict) {
      setStopPolling(true)
    }
  }, [reviewStatus.data?.verdict])

  const getValidationStatus = () => {
    // If we don't have a verdict yet, show loading while polling
    const verdict = reviewStatus.data?.verdict
    if (
      !verdict &&
      !timedOut &&
      !aiValidation.isError &&
      !reviewStatus.isError
    ) {
      return {
        type: 'loading',
        title: 'Verifying your business...',
        message:
          "We're reviewing your SaaS business details. This usually takes a few seconds.",
        icon: <Loader2 className="h-8 w-8 animate-spin" />,
      }
    }

    // Handle error state with fallback result
    if (aiValidation.isError || reviewStatus.isError || timedOut) {
      return {
        type: 'review_required',
        title: 'Verification Failed',
        message:
          'Technical error during validation. Manual review will be conducted.',
        icon: <AlertTriangle className="h-8 w-8 text-gray-600" />,
        severity: 'error',
      }
    }

    const result = reviewStatus.data
    if (!result) {
      return null
    }

    switch (result.verdict) {
      case 'PASS':
        return {
          type: 'pass',
          title: 'Verification Passed',
          message:
            'Your SaaS business has been verified and approved.',
          icon: <CheckCircle className="h-8 w-8 text-gray-600" />,
        }
      case 'FAIL':
      case 'UNCERTAIN':
        return {
          type: 'review_required',
          title: 'Verification Failed',
          message: result.reason,
          icon: <AlertTriangle className="h-8 w-8 text-gray-600" />,
          severity: 'error',
        }
      default:
        return null
    }
  }

  const status = getValidationStatus()
  if (!status) return null

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Status Header */}
        <div className="flex items-center space-x-4">
          <div className="shrink-0">{status.icon}</div>
          <div className="flex-1">
            <h3 className={`text-lg font-medium`}>{status.title}</h3>
            <p className="dark:text-polar-400 mt-1 text-sm text-gray-600">
              {status.message}
            </p>
          </div>
        </div>

        {/* Information Message */}
        <Card className={`rounded-lg p-4`}>
          <div className="flex items-start space-x-3">
            <Info className={`dark:text-polar-400 h-5 w-5 text-gray-600`} />
            <div className="flex-1">
              <h4 className={`text-sm font-medium`}>What happens next?</h4>
              <p className={`dark:text-polar-400 mt-1 text-sm text-gray-600`}>
                {status.type === 'pass'
                  ? 'Your business has been verified. You can start accepting payments immediately. A final review will happen before your first payout.'
                  : status.type === 'review_required'
                    ? "We couldn't verify your business automatically. You can submit additional details below for manual review."
                    : "Please wait while we verify your business details."}
              </p>
            </div>
          </div>
        </Card>

        {/* Appeal Form for FAIL/UNCERTAIN or Continue Button */}
        {((reviewStatus.data && reviewStatus.data.verdict) ||
          aiValidation.isError ||
          timedOut) && (
          <>
            {status.type === 'review_required' ? (
              <div className="pt-6">
                <AppealForm
                  organization={organization}
                  disabled={false} // Set to true to disable appeals
                  onAppealApproved={onAppealApproved}
                  onContinueAfterSubmission={onAppealSubmitted}
                  existingReviewStatus={reviewStatus.data}
                />
              </div>
            ) : (
              <div className="flex justify-center pt-6">
                <Button
                  onClick={() => {
                    if (onValidationCompleted) {
                      onValidationCompleted()
                    }
                  }}
                  className="w-auto"
                >
                  Continue to Account Setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

export default AIValidationResult
