'use client'

import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import AccountsList from '@/components/Accounts/AccountsList'
import StreamlinedAccountReview from '@/components/Finance/StreamlinedAccountReview'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useAuth } from '@/hooks'
import {
  useCreateIdentityVerification,
  useListAccounts,
  useOrganizationAccount,
} from '@/hooks/queries'
import { useOrganizationReviewStatus } from '@/hooks/queries/org'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { loadStripe } from '@stripe/stripe-js'
import React, { useCallback, useState } from 'react'

export default function ClientPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const { currentUser, reloadUser } = useAuth()
  const { data: accounts } = useListAccounts()
  const {
    isShown: isShownSetupModal,
    show: showSetupModal,
    hide: hideSetupModal,
  } = useModal()

  const [requireDetails, setRequireDetails] = useState(
    !organization.details_submitted_at,
  )
  const identityVerificationStatus = currentUser?.identity_verification_status
  const identityVerified = identityVerificationStatus === 'verified'

  const { data: organizationAccount, error: accountError } =
    useOrganizationAccount(organization.id)
  const { data: reviewStatus } = useOrganizationReviewStatus(organization.id)

  const [validationCompleted, setValidationCompleted] = useState(false)

  const isNotAdmin =
    accountError && (accountError as any)?.response?.status === 403

  type Step = 'review' | 'validation' | 'account' | 'identity' | 'complete'

  const getInitialStep = (): Step => {
    if (!organization.details_submitted_at) {
      return 'review'
    }

    // Skip validation if AI validation passed, appeal is approved, or appeal is submitted
    const aiValidationPassed = reviewStatus?.verdict === 'PASS'
    const appealApproved = reviewStatus?.appeal_decision === 'approved'
    const appealSubmitted = reviewStatus?.appeal_submitted_at
    const skipValidation =
      aiValidationPassed ||
      appealApproved ||
      appealSubmitted ||
      validationCompleted

    if (!skipValidation) {
      return 'validation'
    }

    if (
      organizationAccount === undefined ||
      !organizationAccount.stripe_id ||
      !organizationAccount.is_details_submitted ||
      !organizationAccount.is_payouts_enabled
    ) {
      return 'account'
    }
    if (!identityVerified) {
      return 'identity'
    }
    return 'complete'
  }

  const [step, setStep] = useState<Step>(getInitialStep())

  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')
  const createIdentityVerification = useCreateIdentityVerification()
  const startIdentityVerification = useCallback(async () => {
    const { data, error } = await createIdentityVerification.mutateAsync()
    if (error) {
      // Handle specific error cases
      const errorDetail = (error as any).detail
      if (
        errorDetail?.error === 'IdentityVerificationProcessing' ||
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
              : errorDetail?.detail ||
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
    await reloadUser()
  }, [createIdentityVerification, stripePromise, reloadUser])

  // Auto-advance to next step when details are submitted, appeal is approved, or appeal is submitted
  React.useEffect(() => {
    if (organization.details_submitted_at) {
      const aiValidationPassed = reviewStatus?.verdict === 'PASS'
      const appealApproved = reviewStatus?.appeal_decision === 'approved'
      const appealSubmitted = reviewStatus?.appeal_submitted_at
      const skipValidation =
        aiValidationPassed ||
        appealApproved ||
        appealSubmitted ||
        validationCompleted

      if (!skipValidation) {
        setStep('validation')
      } else if (
        organizationAccount === undefined ||
        !organizationAccount.stripe_id ||
        !organizationAccount.is_details_submitted ||
        !organizationAccount.is_payouts_enabled
      ) {
        setStep('account')
      } else if (!identityVerified) {
        setStep('identity')
      } else {
        setStep('complete')
      }
    }
  }, [
    organization.details_submitted_at,
    validationCompleted,
    organizationAccount,
    identityVerified,
    reviewStatus?.appeal_decision,
    reviewStatus?.appeal_submitted_at,
    reviewStatus?.verdict,
    isNotAdmin,
  ])

  const handleDetailsSubmitted = useCallback(() => {
    setRequireDetails(false)
    setStep('validation')
  }, [])

  const handleValidationCompleted = useCallback(() => {
    setValidationCompleted(true)
    setStep('account')
  }, [])

  const handleStartAccountSetup = useCallback(async () => {
    // Check if account exists but has no stripe_id (deleted account)
    if (!organizationAccount || !organizationAccount.stripe_id) {
      showSetupModal()
    } else {
      const link = await unwrap(
        api.POST('/v1/accounts/{id}/onboarding_link', {
          params: {
            path: {
              id: organizationAccount.id,
            },
            query: {
              return_path: `/dashboard/${organization.slug}/finance/account`,
            },
          },
        }),
      )
      window.location.href = link.url
    }
  }, [organization.slug, organizationAccount, showSetupModal])

  const handleStartIdentityVerification = useCallback(async () => {
    await startIdentityVerification()
  }, [startIdentityVerification])

  const handleAppealApproved = useCallback(() => {
    if (
      !organizationAccount ||
      !organizationAccount.stripe_id ||
      !organizationAccount.is_details_submitted ||
      !organizationAccount.is_payouts_enabled
    ) {
      setValidationCompleted(true)
      setStep('account')
      return
    }

    if (!identityVerified) {
      setValidationCompleted(true)
      setStep('identity')
      return
    }

    setValidationCompleted(true)
    setStep('complete')
  }, [organizationAccount, identityVerified])

  const handleSkipAccountSetup = useCallback(() => {
    if (!identityVerified) {
      setStep('identity')
    } else {
      setStep('complete')
    }
  }, [identityVerified])

  const handleAppealSubmitted = useCallback(() => {
    setStep('account')
    return
  }, [])

  const handleNavigateToStep = useCallback(
    (targetStep: Step) => {
      // Allow navigation to any step that has been completed or is accessible
      const canNavigate =
        (targetStep === 'review' && organization.details_submitted_at) ||
        (targetStep === 'validation' && reviewStatus) ||
        (targetStep === 'account' &&
          (validationCompleted ||
            reviewStatus?.verdict === 'PASS' ||
            reviewStatus?.appeal_decision === 'approved' ||
            reviewStatus?.appeal_submitted_at)) ||
        (targetStep === 'identity' &&
          (organizationAccount?.is_details_submitted || isNotAdmin))

      if (canNavigate) {
        setStep(targetStep)
      }
    },
    [
      organization.details_submitted_at,
      reviewStatus,
      validationCompleted,
      organizationAccount,
      isNotAdmin,
    ],
  )

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-6">
        <StreamlinedAccountReview
          organization={organization}
          currentStep={step}
          requireDetails={requireDetails}
          organizationAccount={organizationAccount}
          identityVerified={identityVerified}
          identityVerificationStatus={identityVerificationStatus}
          organizationReviewStatus={reviewStatus}
          isNotAdmin={isNotAdmin}
          onDetailsSubmitted={handleDetailsSubmitted}
          onValidationCompleted={handleValidationCompleted}
          onStartAccountSetup={handleStartAccountSetup}
          onStartIdentityVerification={handleStartIdentityVerification}
          onSkipAccountSetup={handleSkipAccountSetup}
          onAppealApproved={handleAppealApproved}
          onAppealSubmitted={handleAppealSubmitted}
          onNavigateToStep={handleNavigateToStep}
        />

        {accounts?.items && accounts.items.length > 0 ? (
          <ShadowBoxOnMd>
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-col gap-y-2">
                <h2 className="text-lg font-medium">All payout accounts</h2>
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  Payout accounts you manage
                </p>
              </div>
            </div>
            <Separator className="my-8" />
            {accounts?.items && (
              <AccountsList
                accounts={accounts?.items}
                pauseActions={requireDetails}
              />
            )}
          </ShadowBoxOnMd>
        ) : null}

        <Modal
          title="Create Payout Account"
          isShown={isShownSetupModal}
          className="min-w-[400px]"
          hide={hideSetupModal}
          modalContent={
            <AccountCreateModal
              forOrganizationId={organization.id}
              returnPath={`/dashboard/${organization.slug}/finance/account`}
            />
          }
        />
      </div>
    </DashboardBody>
  )
}
