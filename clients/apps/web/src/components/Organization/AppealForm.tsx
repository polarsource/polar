'use client'

import {
  useOrganizationAppeal,
  useOrganizationReviewStatus,
} from '@/hooks/queries/org'
import { getQueryClient } from '@/utils/api/query'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Textarea } from '@polar-sh/ui/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import React, { useState } from 'react'

interface AppealFormProps {
  organization: schemas['Organization']
  reason?: string | null
  existingReviewStatus?: schemas['OrganizationReviewStatus']
}

const AppealForm: React.FC<AppealFormProps> = ({
  organization,
  reason,
  existingReviewStatus,
}) => {
  const [appealReason, setAppealReason] = useState('')
  const [showForm, setShowForm] = useState(false)

  const appealMutation = useOrganizationAppeal(organization.id)
  const reviewStatus = useOrganizationReviewStatus(organization.id)

  // Use existing review status if provided, otherwise use fetched data
  const currentReviewStatus = existingReviewStatus || reviewStatus.data

  const isSubmitted =
    !!currentReviewStatus?.appeal_submitted_at || appealMutation.isSuccess
  const displayedAppealReason =
    currentReviewStatus?.appeal_reason || appealReason

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (appealReason.length < 50) {
      return
    }

    try {
      await appealMutation.mutateAsync({ reason: appealReason })

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
      <div className="space-y-4">
        <div>
          <h4 className="mb-1 font-medium">
            {decision === 'approved'
              ? 'Appeal approved'
              : decision === 'rejected'
                ? 'Appeal denied'
                : 'Appeal under review'}
          </h4>
          <p className="dark:text-polar-400 text-sm text-gray-600">
            {decision === 'approved'
              ? 'Your appeal has been approved. Payment access has been restored.'
              : decision === 'rejected'
                ? 'Your appeal has been reviewed and denied. Please contact support for further assistance.'
                : 'Our team will review your case and get back to you as soon as possible.'}
          </p>
          {submissionDate && (
            <p className="dark:text-polar-400 mt-2 text-xs text-gray-500">
              Submitted: {new Date(submissionDate).toLocaleDateString()}
              {reviewedAt &&
                ` · Reviewed: ${new Date(reviewedAt).toLocaleDateString()}`}
            </p>
          )}
        </div>

        {displayedAppealReason && (
          <>
            <div className="dark:bg-polar-800 rounded-lg bg-white p-3">
              <p className="dark:text-polar-300 text-sm text-gray-700">
                {displayedAppealReason}
              </p>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {reason && (
          <p className="dark:text-polar-400 text-sm text-gray-600">{reason}</p>
        )}
        {!showForm && (
          <p className="dark:text-polar-400 text-sm text-gray-600">
            If you believe this is incorrect, you can{' '}
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="cursor-pointer underline hover:no-underline"
            >
              submit an appeal
            </button>{' '}
            for manual review.
          </p>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Why should your organization be approved?
            </label>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              Please explain why you believe this decision is incorrect. Include
              any context about your business that may help us reconsider.
            </p>
            <Textarea
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              className="dark:bg-polar-800 min-h-32 w-full bg-white"
              placeholder="Explain why your organization should be approved despite the initial review decision…"
              maxLength={5000}
            />
            <div className="flex justify-between text-xs">
              <span className={'text-gray-500'}>
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
              variant="ghost"
              className="opacity-60"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || appealMutation.isPending}
              className="w-auto"
            >
              {appealMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Submit Appeal
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

export default AppealForm
