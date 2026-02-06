'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import {
  ArrowRight,
  CheckCircle,
  Fingerprint,
  Loader2,
  XCircle,
} from 'lucide-react'
import React from 'react'

interface IdentityStepProps {
  identityVerificationStatus?: string
  onStartIdentityVerification: () => void
}

export default function IdentityStep({
  identityVerificationStatus,
  onStartIdentityVerification,
}: IdentityStepProps) {
  if (identityVerificationStatus === 'verified') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
          <CheckCircle className="h-6 w-6 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-medium dark:text-white">Identity verified</h3>
          <p className="dark:text-polar-400 mt-1 text-sm text-gray-500">
            Your identity has been successfully verified.
          </p>
        </div>
      </div>
    )
  }

  if (identityVerificationStatus === 'pending') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        </div>
        <div>
          <h3 className="font-medium dark:text-white">
            Verification in progress
          </h3>
          <p className="dark:text-polar-400 mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Your identity verification is being processed. This usually takes a
            few minutes but can take up to 24 hours.
          </p>
        </div>
      </div>
    )
  }

  if (identityVerificationStatus === 'failed') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
          <XCircle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h3 className="font-medium text-red-600 dark:text-red-400">
            Verification failed
          </h3>
          <p className="dark:text-polar-400 mx-auto mt-1 max-w-sm text-sm text-gray-500">
            We were unable to verify your identity. This could be due to
            document quality or information mismatch. Please try again.
          </p>
        </div>
        <Button onClick={onStartIdentityVerification} className="mt-2">
          Try Again
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  // Default: not started
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
        <Fingerprint className="h-6 w-6 text-blue-500" />
      </div>
      <div>
        <h3 className="font-medium dark:text-white">Verify your identity</h3>
        <p className="dark:text-polar-400 mx-auto mt-1 max-w-sm text-sm text-gray-500">
          As your merchant of record, we&apos;re required to verify account
          holders. This takes less than 2 minutes.
        </p>
      </div>
      <Button onClick={onStartIdentityVerification} className="mt-2">
        Start Verification
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}
