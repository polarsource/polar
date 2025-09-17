'use client'

import { useOrganizationAIValidation } from '@/hooks/queries/org'
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
import React, { useCallback, useEffect, useRef, useState } from 'react'
import AppealForm from './AppealForm'

interface AIValidationResultProps {
  organization: schemas['Organization']
  autoValidate?: boolean
  onValidationCompleted?: () => void
  onAppealApproved?: () => void
  onAppealSubmitted?: () => void
  existingReviewStatus?: schemas['OrganizationReviewStatus']
}

interface ValidationResult {
  verdict: 'PASS' | 'FAIL' | 'UNCERTAIN'
  reason: string
  timed_out: boolean
}

const AIValidationResult: React.FC<AIValidationResultProps> = ({
  organization,
  autoValidate = false,
  onValidationCompleted,
  onAppealApproved,
  onAppealSubmitted,
  existingReviewStatus,
}) => {
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null)
  const hasAutoValidatedRef = useRef(false)

  const aiValidation = useOrganizationAIValidation(organization.id)

  const runValidation = useCallback(async () => {
    // Prevent multiple concurrent calls
    if (aiValidation.isPending) {
      return
    }

    try {
      const response = await aiValidation.mutateAsync()
      const { data, error } = response

      if (error) {
        throw new Error(`AI validation failed: ${error}`)
      }

      setValidationResult(data)
    } catch (error) {
      console.error('AI validation failed:', error)
      // Set a fallback result for error cases
      const errorResult: ValidationResult = {
        verdict: 'UNCERTAIN',
        reason:
          'Technical error during validation. Manual review will be conducted.',
        timed_out: false,
      }
      setValidationResult(errorResult)
      // Don't auto-progress - let user click continue button
    }
  }, [aiValidation])

  // Auto-validate when component mounts if autoValidate is true
  useEffect(() => {
    if (autoValidate && !hasAutoValidatedRef.current) {
      hasAutoValidatedRef.current = true
      runValidation()
    }
  }, [autoValidate, runValidation])

  const getValidationStatus = () => {
    // Check for actual data first, regardless of pending state
    const result =
      validationResult ||
      (aiValidation.isSuccess ? aiValidation.data?.data : null) ||
      existingReviewStatus

    // Only show loading if we don't have results and the request is pending
    if (aiValidation.isPending && !result) {
      return {
        type: 'loading',
        title: 'Validating Organization Details...',
        message:
          'Our AI is reviewing your organization details against our acceptable use policy. This may take up to 25 seconds.',
        icon: <Loader2 className="h-8 w-8 animate-spin" />,
      }
    }

    if (!result) {
      return null
    }

    switch (result.verdict) {
      case 'PASS':
        return {
          type: 'pass',
          title: 'AI Validation Successful',
          message:
            'Your organization details have been automatically validated against our acceptable use policy.',
          icon: <CheckCircle className="h-8 w-8 text-gray-600" />,
        }
      case 'FAIL':
      case 'UNCERTAIN':
        return {
          type: 'review_required',
          title: 'Payment Access Denied',
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
          <div className="flex-shrink-0">{status.icon}</div>
          <div className="flex-1">
            <h3 className={`text-lg font-medium`}>{status.title}</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {status.message}
            </p>
          </div>
        </div>

        {/* Information Message */}
        <Card className={`rounded-lg p-4`}>
          <div className="flex items-start space-x-3">
            <Info className={`h-5 w-5 text-gray-600 dark:text-gray-400`} />
            <div className="flex-1">
              <h4 className={`text-sm font-medium`}>What happens next?</h4>
              <p className={`mt-1 text-sm text-gray-600 dark:text-gray-400`}>
                {status.type === 'pass'
                  ? 'Your organization details passed our automated compliance check. You can accept payments immediately, but a manual review will still occur before your first payout as part of our standard process.'
                  : status.type === 'review_required'
                    ? 'Payments are currently blocked for your organization due to our compliance review. You can submit an appeal below if you believe this decision is incorrect.'
                    : 'Please wait while we validate your organization details.'}
              </p>
            </div>
          </div>
        </Card>

        {/* Appeal Form for FAIL/UNCERTAIN or Continue Button */}
        {(validationResult ||
          (aiValidation.isSuccess && aiValidation.data?.data) ||
          existingReviewStatus) && (
          <>
            {status.type === 'review_required' ? (
              <div className="pt-6">
                <AppealForm
                  organization={organization}
                  disabled={false} // Set to true to disable appeals
                  onAppealApproved={onAppealApproved}
                  onContinueAfterSubmission={onAppealSubmitted}
                  existingReviewStatus={existingReviewStatus}
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
