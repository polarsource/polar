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
import CustomerCancellationModal from './CustomerCancellationModal'

const useMissingBillingDetails = () => {
  const { data: customer } = useCustomerPortalCustomer()

  return {
    paymentMethod: !!customer && !customer.default_payment_method_id,
    billingAddress: !!customer && !customer.billing_address?.country,
  }
}

export const useIsMissingBillingDetails = () => {
  const missing = useMissingBillingDetails()
  return missing.paymentMethod || missing.billingAddress
}

export const TrialBillingDetailsAlert = () => {
  const missing = useMissingBillingDetails()

  const details = [
    missing.paymentMethod && 'a payment method',
    missing.billingAddress && 'a billing address',
  ].filter(Boolean)

  return (
    <Alert
      variant="warning"
      title="Add your billing details"
      description={`Add ${details.join(' and ')} to keep your subscription after the trial ends.`}
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
  const isMissingBillingDetails = useIsMissingBillingDetails()
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
