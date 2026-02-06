'use client'

import {
  useOrganizationAppeal,
  useOrganizationReviewStatus,
} from '@/hooks/queries/org'
import { getQueryClient } from '@/utils/api/query'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Card } from '@polar-sh/ui/components/ui/card'
import { Textarea } from '@polar-sh/ui/components/ui/textarea'
import { ArrowRight, Loader2, Send, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'

interface AppealFormProps {
  organization: schemas['Organization']
  disabled?: boolean
  onAppealApproved?: () => void
  onContinueAfterSubmission?: () => void
  existingReviewStatus?: schemas['OrganizationReviewStatus']
}

const AppealForm: React.FC<AppealFormProps> = ({
  organization,
  disabled = false,
  onAppealApproved,
  onContinueAfterSubmission,
  existingReviewStatus,
}) => {
  const [appealReason, setAppealReason] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const appealMutation = useOrganizationAppeal(organization.id)
  const reviewStatus = useOrganizationReviewStatus(organization.id)

  // Use existing review status if provided, otherwise use fetched data
  const currentReviewStatus = existingReviewStatus || reviewStatus.data

  // Update state based on existing review status
  useEffect(() => {
    if (currentReviewStatus?.appeal_submitted_at) {
      setIsSubmitted(true)
      if (currentReviewStatus.appeal_reason) {
        setAppealReason(currentReviewStatus.appeal_reason)
      }
    }
  }, [currentReviewStatus])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (appealReason.length < 50) {
      return
    }

    try {
      await appealMutation.mutateAsync({ reason: appealReason })
      setIsSubmitted(true)

      // Invalidate the review status query to refresh the data
      getQueryClient().invalidateQueries({
        queryKey: ['organizationReviewStatus', organization.id],
      })
    } catch (error) {
      console.error('Failed to submit appeal:', error)
    }
  }

  const characterCount = appealReason.length
  const isValid = characterCount >= 50 && characterCount <= 5000

  if (isSubmitted) {
    const submissionDate = currentReviewStatus?.appeal_submitted_at
    const decision = currentReviewStatus?.appeal_decision
    const reviewedAt = currentReviewStatus?.appeal_reviewed_at

    return (
      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <h3 className="text-lg font-medium">
                {decision === 'approved'
                  ? 'Review Approved'
                  : decision === 'rejected'
                    ? 'Review Denied'
                    : 'Under Review'}
              </h3>
              <p className="dark:text-polar-400 mt-1 text-sm text-gray-600">
                {decision === 'approved'
                  ? 'Your business has been approved. You can proceed with setup.'
                  : decision === 'rejected'
                    ? "Unfortunately, your business doesn't meet our requirements at this time. Please contact support for more information."
                    : 'Thanks for the additional details. Our team will review your case shortly.'}
              </p>
              {submissionDate && (
                <p className="dark:text-polar-400 mt-2 text-xs text-gray-500">
                  Submitted: {new Date(submissionDate).toLocaleDateString()}
                  {reviewedAt &&
                    ` • Reviewed: ${new Date(reviewedAt).toLocaleDateString()}`}
                </p>
              )}
            </div>
          </div>

          {/* Next button for approved appeals or continue after submission */}
          {decision === 'approved' && onAppealApproved ? (
            <div className="flex justify-center pt-4">
              <Button onClick={onAppealApproved} className="w-auto">
                Continue to Account Setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : decision !== 'rejected' && onContinueAfterSubmission ? (
            <div className="flex justify-center pt-4">
              <Button onClick={onContinueAfterSubmission} className="w-auto">
                Continue Setup While Under Review
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : null}

          {/* Show the appeal reason */}
          {appealReason && (
            <div className="border-t pt-4">
              <h4 className="dark:text-polar-300 mb-2 text-sm font-medium text-gray-700">
                Your Submission:
              </h4>
              <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-3">
                <p className="dark:text-polar-300 text-sm whitespace-pre-wrap text-gray-700">
                  {appealReason}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    )
  }

  if (!showForm) {
    return (
      <Card className={`p-6 ${disabled ? 'opacity-60' : ''}`}>
        <div className="space-y-4 text-center">
          <h3 className="text-lg font-medium">Request Manual Review</h3>
          <p className="dark:text-polar-400 text-sm text-gray-600">
            {disabled
              ? 'Manual review is currently unavailable. Please contact support if you believe this is a mistake.'
              : 'If you believe this is a mistake, provide more details and our team will review your case.'}
          </p>
          <Button
            onClick={() => setShowForm(true)}
            className="w-auto"
            disabled={disabled}
          >
            <Send className="mr-2 h-4 w-4" />
            {disabled ? 'Review Unavailable' : 'Provide Details'}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-6 ${disabled ? 'opacity-60' : ''}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Request Review</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(false)}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Tell us more about your SaaS business *
          </label>
          <p className="dark:text-polar-400 text-xs text-gray-500">
            {disabled
              ? 'Manual review is currently unavailable. Please contact support for assistance.'
              : 'Describe your SaaS product, your customers, and how you generate revenue. The more detail you provide, the faster we can review your case.'}
          </p>
          <Textarea
            value={appealReason}
            onChange={(e) => setAppealReason(e.target.value)}
            disabled={disabled}
            className={`min-h-32 w-full`}
            placeholder={
              disabled
                ? 'Review unavailable...'
                : 'Describe your SaaS product, target customers, and pricing model...'
            }
            maxLength={5000}
          />
          <div className="flex justify-between text-xs">
            <span
              className={characterCount < 50 ? 'text-red-500' : 'text-gray-500'}
            >
              Minimum 50 characters required
            </span>
            <span
              className={
                characterCount > 5000 ? 'text-red-500' : 'text-gray-500'
              }
            >
              {characterCount}/5000
            </span>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowForm(false)}
            disabled={disabled}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={disabled || !isValid || appealMutation.isPending}
            className="w-auto"
          >
            {appealMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {disabled ? 'Review Unavailable' : 'Submit for Review'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

export default AppealForm
