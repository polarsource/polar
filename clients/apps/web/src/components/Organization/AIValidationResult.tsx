'use client'

import { useOrganizationReviewStatus } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import AppealForm from './AppealForm'

const AIValidationResult = ({
  organization,
  isPending,
}: {
  organization: schemas['Organization']
  isPending?: boolean
}) => {
  const [timedOut, setTimedOut] = useState(false)
  const [hasVerdict, setHasVerdict] = useState(false)

  const shouldPoll = !timedOut && !hasVerdict
  const reviewStatus = useOrganizationReviewStatus(
    organization.id,
    true,
    shouldPoll ? 3000 : undefined,
  )

  // Timeout after 120s and stop polling
  useEffect(() => {
    if (timedOut || !shouldPoll) return
    const timeout = setTimeout(() => setTimedOut(true), 120_000)
    return () => clearTimeout(timeout)
  }, [timedOut, shouldPoll])

  // Stop polling once a verdict is present (render-time state sync)
  if (reviewStatus.data?.verdict && !hasVerdict) {
    setHasVerdict(true)
  }

  const getValidationStatus = () => {
    if (isPending) {
      return {
        type: 'loading',
        title: 'Retrieving organization status…',
        message: '',
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
      }
    }

    // If we don't have a verdict yet, show loading while polling
    const verdict = reviewStatus.data?.verdict
    if (!verdict && !timedOut && !reviewStatus.isError) {
      return {
        type: 'loading',
        title: 'Reviewing organization…',
        message:
          'Our AI is reviewing your organization details against our acceptable use policy. This typically takes one to two minutes.',
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
      }
    }

    // Handle error state with fallback result
    if (reviewStatus.isError || timedOut) {
      return {
        type: 'review_required',
        title: 'Payment access denied',
        message:
          'Technical error during validation. A manual review will be conducted.',
        icon: (
          <AlertTriangle className="dark:text-polar-400 h-4 w-4 text-gray-500" />
        ),
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
          title: 'Approved!',
          message:
            'Your organization details have been automatically validated. You can accept payments immediately, but a manual review will still occur before your first payout.',
          icon: (
            <CheckCircle className="dark:text-polar-400 -mt-0.5 h-4 w-4 text-gray-500" />
          ),
        }
      case 'FAIL':
        return {
          type: 'review_required',
          title: 'Payment access denied',
          message: 'Your organization does not meet our acceptable use policy.',
          icon: (
            <AlertTriangle className="dark:text-polar-400 -mt-0.5 h-4 w-4 text-gray-500" />
          ),
        }
      case 'UNCERTAIN':
        return {
          type: 'review_required',
          title: 'Additional review required',
          message:
            'We were unable to automatically verify your organization. You can submit an appeal to expedite the manual review process.',
          icon: (
            <AlertTriangle className="dark:text-polar-400 h-4 w-4 text-gray-500" />
          ),
        }
      default:
        return null
    }
  }

  const status = getValidationStatus()
  if (!status) return null

  const showAppeal =
    ((reviewStatus.data && reviewStatus.data.verdict) || timedOut) &&
    status.type === 'review_required'

  return (
    <div className="dark:bg-polar-800 rounded-2xl border bg-white">
      <div className="p-8 text-center">
        <span className="dark:bg-polar-700 mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
          {status.icon}
        </span>
        <h4 className="mb-2 font-medium">{status.title}</h4>
        <p className="dark:text-polar-400 mx-auto max-w-2xs text-sm text-pretty text-gray-600">
          {status.message}
        </p>
      </div>

      {showAppeal && (
        <div className="dark:border-polar-700 dark:bg-polar-900 rounded-b-2xl border-t bg-gray-50 p-8 text-left">
          <AppealForm
            organization={organization}
            reason={reviewStatus.data?.reason}
            existingReviewStatus={reviewStatus.data}
          />
        </div>
      )}
    </div>
  )
}

export default AIValidationResult
