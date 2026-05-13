'use client'

import { useStartIdentityVerification } from '@/hooks/identityVerification'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  ArrowRight,
  CheckIcon,
  ClockIcon,
  ShieldIcon,
  XIcon,
} from 'lucide-react'
import { PathCardBanner } from './PathCardBanner'
import { StatusBlock } from './StatusBlock'

interface Props {
  organization: schemas['Organization']
  step: schemas['OrganizationReviewCheck']
  reasonItems: string[]
}

export const IdentityVerificationSection = ({ step, reasonItems }: Props) => {
  const { start, identityVerificationStatus } = useStartIdentityVerification()
  const tone = step.status === 'failed' ? 'danger' : 'warning'
  const banners = reasonItems.length > 0 && (
    <Box display="flex" flexDirection="column" rowGap="m">
      {reasonItems.map((reason) => (
        <PathCardBanner key={reason} tone={tone} title={reason} />
      ))}
    </Box>
  )

  if (identityVerificationStatus === 'verified') {
    return (
      <StatusBlock
        tone="success"
        icon={CheckIcon}
        title="Identity verified"
        description="Your identity has been successfully verified."
      />
    )
  }

  if (identityVerificationStatus === 'pending') {
    return (
      <StatusBlock
        tone="pending"
        icon={ClockIcon}
        title="Identity verification pending"
        description="Your identity verification is being processed. This usually takes a few minutes but can take up to 24 hours. We'll notify you once verification is complete."
      />
    )
  }

  if (identityVerificationStatus === 'failed') {
    return (
      <>
        <StatusBlock
          tone="danger"
          icon={XIcon}
          title="Identity verification failed"
          description="We were unable to verify your identity. This could be due to document quality or information mismatch."
          action={
            <Button onClick={start}>
              Try again
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          }
        />
        {banners}
      </>
    )
  }

  return (
    <>
      <StatusBlock
        tone="neutral"
        icon={ShieldIcon}
        title="Verify your identity"
        description="To comply with financial regulations and secure your account, we need to verify your identity using a government-issued ID."
        action={
          <Button onClick={start}>
            Start identity verification
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        }
      />
      {banners}
    </>
  )
}
