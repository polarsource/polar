'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import { Card } from '@polar-sh/ui/components/ui/card'
import { ArrowRight, CheckCircle } from 'lucide-react'
import React from 'react'

interface IdentityStepProps {
  identityVerificationStatus?: string
  onStartIdentityVerification: () => void
}

const StepCard = ({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) => <Card className={`p-6 ${className}`}>{children}</Card>

export default function IdentityStep({
  identityVerificationStatus,
  onStartIdentityVerification,
}: IdentityStepProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3 text-center">
        <div className="flex items-center justify-center space-x-3">
          <h1 className="text-2xl font-semibold">Identity Verification</h1>
        </div>
        <p className="dark:text-polar-400 mx-auto max-w-2xl text-lg text-gray-600">
          {identityVerificationStatus === 'verified'
            ? 'Your identity has been successfully verified.'
            : identityVerificationStatus === 'pending'
              ? 'Your identity verification is being processed.'
              : identityVerificationStatus === 'failed'
                ? 'Identity verification failed. Please try again.'
                : 'Verify your identity to comply with financial regulations.'}
        </p>
      </div>

      {/* Identity Verification Action */}
      <StepCard>
        <div className="space-y-4">
          <div className="space-y-4 text-center">
            <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-8">
              {identityVerificationStatus === 'pending' ? (
                <>
                  <h4 className="mb-2 font-medium">
                    Identity Verification Pending
                  </h4>
                  <p className="dark:text-polar-400 mx-auto mb-6 max-w-md text-sm text-gray-600">
                    Your identity verification is being processed. This usually
                    takes a few minutes but can take up to 24 hours.
                  </p>
                  <div className="text-xs text-gray-500">
                    We&apos;ll notify you once verification is complete.
                  </div>
                </>
              ) : identityVerificationStatus === 'verified' ? (
                <>
                  <h4 className="mb-2 font-medium">Identity Verified</h4>
                  <p className="dark:text-polar-400 mx-auto text-sm text-gray-600">
                    Your identity has been successfully verified.
                  </p>
                </>
              ) : identityVerificationStatus === 'failed' ? (
                <>
                  <h4 className="mb-2 font-medium text-red-600 dark:text-red-400">
                    Identity Verification Failed
                  </h4>
                  <p className="dark:text-polar-400 mx-auto mb-6 max-w-md text-sm text-gray-600">
                    We were unable to verify your identity. This could be due to
                    document quality or information mismatch. Please try again.
                  </p>
                  <Button
                    onClick={onStartIdentityVerification}
                    className="w-auto"
                    variant="default"
                  >
                    Try Again
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="mb-4 flex justify-center">
                    <div className="dark:bg-polar-900/30 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                      <CheckCircle className="dark:text-polar-400 h-4 w-4 text-gray-600" />
                    </div>
                  </div>
                  <h4 className="mb-2 font-medium">Verify Your Identity</h4>
                  <p className="dark:text-polar-400 mx-auto mb-6 max-w-md text-sm text-gray-600">
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
    </div>
  )
}
