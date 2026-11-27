'use client'

import revalidate from '@/app/actions'
import { toast } from '@/components/Toast/use-toast'
import {
  useCustomerCancelSubscription,
  useCustomerPortalCustomer,
  useCustomerReactivateSubscription,
} from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { Alert, Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { getTaxAddressFields } from '@polar-sh/ui/lib/taxAddressFields'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import CustomerCancellationModal from './CustomerCancellationModal'
import { PortalConfirmDialog } from './PortalDialog'

const hasCompleteBillingAddress = (
  address: schemas['CustomerPortalCustomer']['billing_address'],
) =>
  !!address &&
  getTaxAddressFields(address.country).every((field) => !!address[field])

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

export const TrialEndedAlert = ({
  subscription,
}: {
  subscription: schemas['CustomerSubscription']
}) => {
  const missing = useMissingBillingDetails(subscription)
  const isMissingBillingDetails =
    missing.paymentMethod || missing.billingAddress

  return (
    <Alert
      variant="warning"
      title="Your trial has ended"
      description={
        isMissingBillingDetails
          ? `Add ${describeMissingDetails(missing)}, then reactivate to keep your subscription.`
          : 'Reactivate to keep your subscription.'
      }
    />
  )
}

export const TrialEndedSubscriptionActions = ({
  api,
  subscription,
}: {
  api: Client
  subscription: schemas['CustomerSubscription']
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const missing = useMissingBillingDetails(subscription)
  const reactivateSubscription = useCustomerReactivateSubscription(api)
  const [showConfirm, setShowConfirm] = useState(false)

  if (missing.paymentMethod || missing.billingAddress) {
    return (
      <Box>
        <Link
          href={`/${subscription.product.organization.slug}/portal/settings?${searchParams.toString()}`}
        >
          <Button>Add billing details</Button>
        </Link>
      </Box>
    )
  }

  const handleReactivate = async () => {
    try {
      await reactivateSubscription.mutateAsync({ id: subscription.id })
      await revalidate('customer_portal')
      router.refresh()
      toast({
        title: 'Subscription reactivated',
        description: 'Your subscription is active again.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to reactivate the subscription.',
      })
    }
  }

  return (
    <>
      <Button onClick={() => setShowConfirm(true)}>
        Reactivate subscription
      </Button>
      <PortalConfirmDialog
        isShown={showConfirm}
        hide={() => setShowConfirm(false)}
        title="Reactivate subscription?"
        description="We'll charge your payment method now and start a new billing period."
        confirmText="Reactivate and pay"
        onConfirm={handleReactivate}
      />
    </>
  )
}
