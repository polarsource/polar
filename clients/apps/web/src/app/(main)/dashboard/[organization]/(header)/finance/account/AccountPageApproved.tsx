'use client'

import { StatusBlock } from '@/components/Finance/Account/sections/StatusBlock'
import IdentityStep from '@/components/Finance/Steps/IdentityStep'
import PayoutAccountStep from '@/components/Finance/Steps/PayoutAccountStep'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { toast } from '@/components/Toast/use-toast'
import { isTerminalStatus } from '@/hooks/identityVerification'
import { useAuth } from '@/hooks'
import { useCreateIdentityVerification } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { CheckIcon } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { loadPolarStripe } from '@/utils/stripe'

interface Props {
  organization: schemas['Organization']
}

export const AccountPageApproved = ({ organization }: Props) => {
  const { currentUser, reloadUser } = useAuth()
  const identityVerificationStatus = currentUser?.identity_verification_status
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stripePromise = loadPolarStripe()
  const createIdentityVerification = useCreateIdentityVerification()

  const startIdentityVerification = useCallback(async () => {
    const { data, error } = await createIdentityVerification.mutateAsync()
    if (error) {
      const errorBody = error as Record<string, unknown>
      const errorDetail = errorBody.detail as
        | string
        | { error?: string; detail?: string }
        | undefined
      const errorMessage = extractApiErrorMessage(
        {
          detail:
            typeof errorDetail === 'object' ? errorDetail?.detail : errorDetail,
        },
        'Unable to start identity verification. Please try again.',
      )
      if (
        (typeof errorDetail === 'object' &&
          errorDetail?.error === 'IdentityVerificationProcessing') ||
        errorDetail === 'Your identity verification is still processing.'
      ) {
        toast({
          title: 'Identity verification in progress',
          description:
            'Your identity verification is already being processed. Please wait for it to complete.',
        })
      } else {
        toast({
          title: 'Error starting identity verification',
          description: errorMessage,
        })
      }
      return
    }
    const stripe = await stripePromise
    if (!stripe) {
      toast({
        title: 'Error loading Stripe',
        description: 'Unable to load identity verification. Please try again.',
      })
      return
    }
    const { error: stripeError } = await stripe.verifyIdentity(
      data.client_secret,
    )
    if (stripeError) {
      toast({
        title: 'Identity verification error',
        description:
          stripeError.message ||
          'Something went wrong during verification. Please try again.',
      })
      return
    }
    await reloadUser()
    pollingRef.current = setInterval(async () => {
      await reloadUser()
    }, 3000)
    setTimeout(() => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }, 30_000)
  }, [createIdentityVerification, stripePromise, reloadUser])

  useEffect(() => {
    if (pollingRef.current && isTerminalStatus(identityVerificationStatus)) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [identityVerificationStatus])

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-sm)!">
      <div className="flex flex-col gap-y-12">
        <Section>
          <SectionDescription
            title="Account Review"
            description="Your submitted organization details and compliance status."
          />
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
              title="Account approved"
              description="Your product and organization details have been reviewed and approved."
            />
          </Box>
        </Section>

        <Section>
          <SectionDescription
            title="Payout Account"
            description="Set up your payout account to receive payouts."
          />
          <PayoutAccountStep organization={organization} />
        </Section>

        <Section>
          <SectionDescription
            title="Identity Verification"
            description="Verify your identity to comply with financial regulations."
          />
          <IdentityStep
            identityVerificationStatus={identityVerificationStatus}
            onStartIdentityVerification={startIdentityVerification}
          />
        </Section>
      </div>
    </DashboardBody>
  )
}
