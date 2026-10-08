'use client'

import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowRight, CheckIcon } from 'lucide-react'
import { StatusBlock } from '../Account/sections/StatusBlock'

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
      <Box
        flexDirection="column"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        backgroundColor="background-card"
      >
        <StatusBlock
          tone="success"
          icon={CheckIcon}
          title="Identity verified"
          description="Your identity has been successfully verified."
        />
      </Box>
    )
  }

  return (
    <div className="dark:bg-polar-800 rounded-2xl border bg-white p-8 text-center">
      {identityVerificationStatus === 'pending' ? (
        <>
          <h4 className="mb-2 font-medium">Identity verification pending</h4>
          <p className="dark:text-polar-400 mx-auto mb-3 max-w-md text-sm text-gray-500">
            Your identity verification is being processed. This usually takes a
            few minutes but can take up to 24 hours.
          </p>
          <div className="text-sm text-gray-500">
            We&apos;ll notify you once verification is complete.
          </div>
        </>
      ) : identityVerificationStatus === 'failed' ? (
        <>
          <h4 className="mb-2 font-medium text-red-600 dark:text-red-400">
            Identity verification failed
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
          <h4 className="mb-2 font-medium">Verify your identity</h4>
          <p className="dark:text-polar-400 mx-auto mb-6 max-w-md text-sm text-gray-500">
            To comply with financial regulations and secure your account, we
            need to verify your identity using a government-issued ID.
          </p>
          <Button onClick={onStartIdentityVerification} className="w-auto">
            Start Identity Verification
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}
