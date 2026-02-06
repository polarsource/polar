'use client'

import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import StreamlinedAccountReview from '@/components/Finance/StreamlinedAccountReview'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import { useAuth } from '@/hooks'
import {
  useCreateIdentityVerification,
  useMetrics,
  useOrganizationAccount,
  useOrganizationPaymentStatus,
} from '@/hooks/queries'
import { useOrganizationReviewStatus } from '@/hooks/queries/org'
import {
  getChartRangeParams,
  getPreviousParams,
} from '@/utils/metrics'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { loadStripe } from '@stripe/stripe-js'
import React, { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const OVERVIEW_METRICS: (keyof schemas['Metrics'])[] = [
  'revenue',
  'orders',
  'average_order_value',
  'cumulative_revenue',
]

// --- Overview Metrics: exact same grid layout as Analytics MetricGroup ---

const OverviewMetrics = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [startDate, endDate, interval] = useMemo(
    () => getChartRangeParams('30d', organization.created_at),
    [organization.created_at],
  )

  const { data, isLoading } = useMetrics({
    organization_id: organization.id,
    startDate,
    endDate,
    interval,
    metrics: OVERVIEW_METRICS,
  })

  const previousParams = useMemo(
    () => getPreviousParams(startDate, '30d'),
    [startDate],
  )

  const { data: previousData } = useMetrics(
    {
      organization_id: organization.id,
      startDate: previousParams ? previousParams[0] : startDate,
      endDate: previousParams ? previousParams[1] : endDate,
      interval,
      metrics: OVERVIEW_METRICS,
    },
    previousParams !== null,
  )

  return (
    <div className="flex flex-col gap-y-6">
      <div className="dark:border-polar-700 flex flex-col overflow-hidden rounded-2xl border border-gray-200">
        <div className="grid grid-cols-1 flex-col [clip-path:inset(1px_1px_1px_1px)] md:grid-cols-2 lg:grid-cols-3">
          {OVERVIEW_METRICS.map((metricKey, index) => (
            <MetricChartBox
              key={metricKey}
              data={data}
              previousData={previousData}
              interval={interval}
              metric={metricKey}
              loading={isLoading}
              height={200}
              chartType="line"
              className={twMerge(
                'rounded-none! bg-transparent dark:bg-transparent',
                index === 0 && 'lg:col-span-2',
                'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200 shadow-none',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Account Setup Flow: full copy of AccountPage logic ---

const AccountSetupFlow = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { currentUser, reloadUser } = useAuth()
  const {
    isShown: isShownSetupModal,
    show: showSetupModal,
    hide: hideSetupModal,
  } = useModal()

  const { data: paymentStatus, isLoading: paymentStatusLoading } =
    useOrganizationPaymentStatus(organization.id)

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

  // Auto-advance to next step
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
  }, [])

  const handleNavigateToStep = useCallback(
    (targetStep: Step) => {
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

  // Don't render if payment is already set up or still loading
  if (paymentStatusLoading || !paymentStatus || paymentStatus.payment_ready) {
    return null
  }

  // Don't render if all steps are complete
  if (step === 'complete') {
    return null
  }

  return (
    <>
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
    </>
  )
}

// --- Overview Page ---

interface OverviewPageProps {
  organization: schemas['Organization']
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  return (
    <DashboardBody wide className="gap-y-8 pb-16 md:gap-y-10">
      {/* Full payout account setup flow — disappears when complete */}
      <AccountSetupFlow organization={organization} />

      {/* Metric charts — same grid as Analytics */}
      <OverviewMetrics organization={organization} />

      {/* Recent transactions */}
      <OrdersWidget />
    </DashboardBody>
  )
}
