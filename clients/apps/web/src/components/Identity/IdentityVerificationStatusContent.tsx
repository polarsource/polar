'use client'

import { StatusBlock } from '@/components/Finance/Account/sections/StatusBlock'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import {
  ArrowRight,
  CheckIcon,
  ClockIcon,
  ShieldIcon,
  XIcon,
} from 'lucide-react'

interface Props {
  status: schemas['IdentityVerificationStatus'] | undefined
  onStart: () => void
  notAuthorized?: boolean
  unverifiedDescription?: string
}

const DEFAULT_UNVERIFIED_DESCRIPTION =
  'To comply with financial regulations and secure your account, we need to verify your identity using a government-issued ID.'

export const IdentityVerificationStatusContent = ({
  status,
  onStart,
  notAuthorized = false,
  unverifiedDescription = DEFAULT_UNVERIFIED_DESCRIPTION,
}: Props) => {
  if (notAuthorized) {
    return (
      <StatusBlock
        tone="pending"
        icon={ClockIcon}
        title="Waiting for owner"
        description="Waiting for this organization's owner to finish identity verification."
      />
    )
  }

  if (status === 'verified') {
    return (
      <StatusBlock
        tone="success"
        icon={CheckIcon}
        title="Identity verified"
        description="Your identity has been successfully verified."
      />
    )
  }

  if (status === 'pending') {
    return (
      <StatusBlock
        tone="pending"
        icon={ClockIcon}
        title="Identity verification pending"
        description="Your identity verification is being processed. This usually takes a few minutes but can take up to 24 hours. We'll notify you once verification is complete."
      />
    )
  }

  if (status === 'failed') {
    return (
      <StatusBlock
        tone="danger"
        icon={XIcon}
        title="Identity verification failed"
        description="We were unable to verify your identity. This could be due to document quality or information mismatch."
        action={
          <Button onClick={onStart}>
            Try again
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        }
      />
    )
  }

  return (
    <StatusBlock
      tone="neutral"
      icon={ShieldIcon}
      title="Verify your identity"
      description={unverifiedDescription}
      action={
        <Button onClick={onStart}>
          Start identity verification
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      }
    />
  )
}
