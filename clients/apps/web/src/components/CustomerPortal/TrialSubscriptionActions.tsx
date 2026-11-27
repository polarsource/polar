'use client'

import {
  useCustomerCancelSubscription,
  useCustomerPortalCustomer,
} from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { Alert, Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { hasCompleteBillingAddress } from './BillingDetailsFields'
import CustomerCancellationModal from './CustomerCancellationModal'

const useMissingBillingDetails = (
  subscription: schemas['CustomerSubscription'],
) => {
  const { data: customer } = useCustomerPortalCustomer()

  return {
    paymentMethod:
      !!customer &&
      !subscription.payment_method_id &&
      !customer.default_payment_method_id,
    billingAddress:
      !!customer && !hasCompleteBillingAddress(customer.billing_address),
  }
}

const describeMissingDetails = (
  missing: ReturnType<typeof useMissingBillingDetails>,
) =>
  [
    missing.paymentMethod && 'a payment method',
    missing.billingAddress && 'a billing address',
  ]
    .filter(Boolean)
    .join(' and ')

export const TrialBillingDetailsAlert = ({
  subscription,
}: {
  subscription: schemas['CustomerSubscription']
}) => {
  const missing = useMissingBillingDetails(subscription)

  if (!missing.paymentMethod && !missing.billingAddress) {
    return null
  }

  return (
    <Alert
      variant="warning"
      title="Add your billing details"
      description={`Add ${describeMissingDetails(missing)} to keep your subscription after the trial ends.`}
    />
  )
}

export const TrialSubscriptionActions = ({
  api,
  subscription,
  canChangePlan,
  onChangePlan,
}: {
  api: Client
  subscription: schemas['CustomerSubscription']
  canChangePlan: boolean
  onChangePlan: () => void
}) => {
  const searchParams = useSearchParams()
  const missing = useMissingBillingDetails(subscription)
  const isMissingBillingDetails =
    missing.paymentMethod || missing.billingAddress
  const cancelSubscription = useCustomerCancelSubscription(api)
  const [showCancelModal, setShowCancelModal] = useState(false)

  const organization = subscription.product.organization

  return (
    <>
      {canChangePlan && (
        <Button onClick={onChangePlan} variant="secondary">
          Change plan
        </Button>
      )}

      <Button variant="secondary" onClick={() => setShowCancelModal(true)}>
        Cancel trial
      </Button>

      {isMissingBillingDetails && (
        <Box>
          <Link
            href={`/${organization.slug}/portal/settings?${searchParams.toString()}`}
          >
            <Button>Add billing details</Button>
          </Link>
        </Box>
      )}

      <CustomerCancellationModal
        api={api}
        subscription={subscription}
        isShown={showCancelModal}
        hide={() => setShowCancelModal(false)}
        cancelSubscription={cancelSubscription}
      />
    </>
  )
}

export const TrialEndedAlert = () => (
  <Alert
    variant="warning"
    title="Your trial has ended"
    description="Reactivate to keep your subscription."
  />
)

export const TrialEndedSubscriptionActions = ({
  subscription,
}: {
  subscription: schemas['CustomerSubscription']
}) => {
  const searchParams = useSearchParams()

  return (
    <Link
      href={`/${subscription.product.organization.slug}/portal/subscriptions/${subscription.id}/reactivate?${searchParams.toString()}`}
    >
      <Button>Reactivate subscription</Button>
    </Link>
  )
}
