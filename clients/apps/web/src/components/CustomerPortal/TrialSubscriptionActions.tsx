'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  useCustomerCancelSubscription,
  useCustomerPortalCustomer,
  useCustomerReactivationOrder,
} from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { Alert, Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
  api,
  subscription,
}: {
  api: Client
  subscription: schemas['CustomerSubscription']
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reactivationOrder = useCustomerReactivationOrder(api)

  const onReactivate = async () => {
    try {
      const order = await reactivationOrder.mutateAsync(subscription.id)
      router.push(
        `/${subscription.product.organization.slug}/portal/orders/${order.id}/pay?${searchParams.toString()}`,
      )
    } catch {
      toast({
        title: 'Could not reactivate subscription',
        description: 'Try again in a moment.',
      })
    }
  }

  return (
    <Button
      onClick={onReactivate}
      loading={reactivationOrder.isPending || reactivationOrder.isSuccess}
    >
      Reactivate subscription
    </Button>
  )
}
