'use client'

import {
  useOrganizationAppeal,
  useOrganizationReviewStatus,
} from '@/hooks/queries/org'
import { queryClient } from '@/utils/api/query'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Card } from '@polar-sh/ui/components/ui/card'
import { Textarea } from '@polar-sh/ui/components/ui/textarea'
import { ArrowRight, Loader2, Send, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'

interface AppealFormProps {
  organization: schemas['Organization']
  disabled?: boolean
  onAppealSubmitted?: () => void
  onAppealApproved?: () => void
}

const AppealForm: React.FC<AppealFormProps> = ({
  organization,
  disabled = false,
  onAppealSubmitted,
  onAppealApproved,
}) => {
  const [appealReason, setAppealReason] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const appealMutation = useOrganizationAppeal(organization.id)
  const reviewStatus = useOrganizationReviewStatus(organization.id)

  // Update state based on existing review status
  useEffect(() => {
    if (reviewStatus.data?.appeal_submitted_at) {
      setIsSubmitted(true)
      if (reviewStatus.data.appeal_reason) {
        setAppealReason(reviewStatus.data.appeal_reason)
      }
    }
  }, [reviewStatus.data])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (appealReason.length < 50) {
      return
    }

    try {
      await appealMutation.mutateAsync({ reason: appealReason })
      setIsSubmitted(true)

      // Invalidate the review status query to refresh the data
      queryClient.invalidateQueries({
        queryKey: ['organizationReviewStatus', organization.id],
      })

      if (onAppealSubmitted) {
        onAppealSubmitted()
      }
    } catch (error) {
      console.error('Failed to submit appeal:', error)
    }
  }

  const characterCount = appealReason.length
  const isValid = characterCount >= 50 && characterCount <= 5000

  if (isSubmitted) {
    const submissionDate = reviewStatus.data?.appeal_submitted_at
    const decision = reviewStatus.data?.appeal_decision
    const reviewedAt = reviewStatus.data?.appeal_reviewed_at

    return (
      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <h3 className="text-lg font-medium">
                {decision === 'approved'
                  ? 'Appeal Approved'
                  : decision === 'rejected'
                    ? 'Appeal Denied'
                    : 'Appeal Under Review'}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {decision === 'approved'
                  ? 'Your appeal has been approved. Payment access has been restored.'
                  : decision === 'rejected'
                    ? 'Your appeal has been reviewed and denied. Please contact support for further assistance.'
                    : 'Thank you for submitting your appeal. Our team will review your case and get back to you as soon as possible.'}
              </p>
              {submissionDate && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Submitted: {new Date(submissionDate).toLocaleDateString()}
                  {reviewedAt &&
                    ` • Reviewed: ${new Date(reviewedAt).toLocaleDateString()}`}
                </p>
              )}
            </div>
          </div>

          {/* Next button for approved appeals */}
          {decision === 'approved' && onAppealApproved && (
            <div className="flex justify-center pt-4">
              <Button onClick={onAppealApproved} className="w-auto">
                Continue to Account Setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Show the appeal reason */}
          {appealReason && (
            <div className="border-t pt-4">
              <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Your Appeal:
              </h4>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
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
          <h3 className="text-lg font-medium">Submit an Appeal</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {disabled
              ? 'Appeal functionality is currently disabled. Please contact support if you believe this decision is incorrect.'
              : 'If you believe your organization was incorrectly flagged, you can submit an appeal for manual review.'}
          </p>
          <Button
            onClick={() => setShowForm(true)}
            className="w-auto"
            disabled={disabled}
          >
            <Send className="mr-2 h-4 w-4" />
            {disabled ? 'Appeal Disabled' : 'Start Appeal'}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-6 ${disabled ? 'opacity-60' : ''}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Submit Appeal</h3>
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
            Why should your organization be approved? *
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {disabled
              ? 'Appeal submission is currently disabled. Please contact support for assistance.'
              : "Please provide a detailed explanation of your business model and why it complies with our acceptable use policy. Be specific about what you're selling and how it fits within our guidelines."}
          </p>
          <Textarea
            value={appealReason}
            onChange={(e) => setAppealReason(e.target.value)}
            disabled={disabled}
            className={`min-h-32 w-full`}
            placeholder={
              disabled
                ? 'Appeal submission disabled...'
                : 'Explain why your organization should be approved for payments...'
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
            {disabled ? 'Appeal Disabled' : 'Submit Appeal'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

export default AppealForm
