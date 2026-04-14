'use client'

import PayoutAccountStep from '@/components/Finance/Steps/PayoutAccountStep'
import IdentityStep from '@/components/Finance/Steps/IdentityStep'
import { DashboardBody } from '@/components/Layout/DashboardLayout'

import AIValidationResult from '@/components/Organization/AIValidationResult'
import OrganizationProfileSettings from '@/components/Settings/OrganizationProfileSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { toast } from '@/components/Toast/use-toast'
import { useAuth } from '@/hooks'
import { useCreateIdentityVerification } from '@/hooks/queries'
import { useOrganizationReviewStatus } from '@/hooks/queries/org'
import { usePayoutAccount } from '@/hooks/queries/payout_accounts'
import { schemas } from '@polar-sh/client'
import { loadStripe } from '@stripe/stripe-js'
import { BanIcon, CheckIcon } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

export default function ClientPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const { currentUser, reloadUser } = useAuth()

  const identityVerificationStatus = currentUser?.identity_verification_status
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingInitialStatusRef = useRef<string | undefined | null>(null)

  const { data: payoutAccount } = usePayoutAccount(
    organization.payout_account_id || undefined,
  )
  const { data: reviewStatus } = useOrganizationReviewStatus(organization.id)

  const isGrandfathered =
    reviewStatus?.verdict === 'PASS' &&
    reviewStatus?.reason === 'Grandfathered organization'

  const isDenied = organization.status === 'denied'

  const isActive = ['active', 'review', 'snoozed'].includes(organization.status)

  const [hasSubmittedDetails, setHasSubmittedDetails] = useState(
    !!organization.details_submitted_at,
  )

  const handleDetailsSubmitted = useCallback(() => {
    setHasSubmittedDetails(true)
  }, [])

  const requireDetails =
    !hasSubmittedDetails &&
    (!isGrandfathered || (isGrandfathered && !isActive && !isDenied))

  const isApproved = isDenied
    ? false // Explicit denial always takes precedence, if not, fall back to checking for approval conditions
    : reviewStatus?.verdict === 'PASS' ||
      reviewStatus?.appeal_decision === 'approved' ||
      isActive

  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')
  const createIdentityVerification = useCreateIdentityVerification()
  const startIdentityVerification = useCallback(async () => {
    const { data, error } = await createIdentityVerification.mutateAsync()
    if (error) {
      const errorBody = error as Record<string, unknown>
      const errorDetail = errorBody.detail as
        | string
        | { error?: string; detail?: string }
        | undefined
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
          description:
            typeof errorDetail === 'string'
              ? errorDetail
              : (typeof errorDetail === 'object' && errorDetail?.detail) ||
                'Unable to start identity verification. Please try again.',
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
    pollingInitialStatusRef.current = identityVerificationStatus
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
  }, [
    createIdentityVerification,
    stripePromise,
    reloadUser,
    identityVerificationStatus,
  ])

  useEffect(() => {
    if (
      pollingRef.current &&
      identityVerificationStatus !== pollingInitialStatusRef.current
    ) {
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
            description={
              requireDetails
                ? 'Tell us about your organization so we can review your usecase.'
                : 'Your submitted organization details and compliance status.'
            }
          />
          {requireDetails ? (
            <OrganizationProfileSettings
              organization={organization}
              kyc={true}
              onSubmitted={handleDetailsSubmitted}
            />
          ) : isDenied ? (
            <div className="dark:bg-polar-800 rounded-2xl border bg-white p-8 text-center">
              <span className="dark:bg-polar-700 mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                <BanIcon className="dark:text-polar-400 h-4 w-4 text-gray-500" />
              </span>
              <h4 className="mb-2 font-medium">Account denied</h4>
              <p className="dark:text-polar-400 mx-auto max-w-sm text-sm text-balance text-gray-600">
                You have been denied access to Polar. If you believe this is a
                mistake, please contact support for further assistance.
              </p>
            </div>
          ) : isApproved ? (
            <div className="dark:bg-polar-800 rounded-2xl border bg-white p-8 text-center">
              <span className="dark:bg-polar-700 mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                <CheckIcon className="dark:text-polar-400 h-4 w-4 text-gray-500" />
              </span>
              <h4 className="mb-2 font-medium">Account approved</h4>
              <p className="dark:text-polar-400 mx-auto max-w-sm text-sm text-balance text-gray-600">
                Your product and organization details have been reviewed and
                approved.
              </p>
            </div>
          ) : (
            <AIValidationResult organization={organization} />
          )}
        </Section>

        {!isDenied && (
          <>
            <Section>
              <SectionDescription
                title="Payout Account"
                description="Set up your payout account to receive payouts."
              />
              {!isApproved ? (
                <InfoCard>Please go through account review first</InfoCard>
              ) : (
                <PayoutAccountStep
                  organization={organization}
                  payoutAccount={payoutAccount}
                />
              )}
            </Section>

            <Section>
              <SectionDescription
                title="Identity Verification"
                description="Verify your identity to comply with financial regulations."
              />
              {isApproved ? (
                <IdentityStep
                  identityVerificationStatus={identityVerificationStatus}
                  onStartIdentityVerification={startIdentityVerification}
                />
              ) : (
                <InfoCard>Please go through account review first</InfoCard>
              )}
            </Section>
          </>
        )}
      </div>
    </DashboardBody>
  )
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark:bg-polar-800 rounded-2xl bg-gray-100 p-5 text-center">
      <p className="dark:text-polar-500 text-sm text-gray-500">{children}</p>
    </div>
  )
}
