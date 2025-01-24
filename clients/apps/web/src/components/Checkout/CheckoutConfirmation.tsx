'use client'

import { useCheckoutClientSSE } from '@/hooks/sse'
import { getServerURL } from '@/utils/api'
import { organizationPageLink } from '@/utils/nav'
import { checkoutsCustomClientGet } from '@polar-sh/sdk/funcs/checkoutsCustomClientGet'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'

import { PolarCore } from '@polar-sh/sdk/core'
import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Elements, ElementsConsumer } from '@stripe/react-stripe-js'
import { Stripe, loadStripe } from '@stripe/stripe-js'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import LogoType from '../Brand/LogoType'
import { SpinnerNoMargin } from '../Shared/Spinner'
import CheckoutBenefits from './CheckoutBenefits'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')

const StripeRequiresAction = ({
  stripe,
  checkout,
}: {
  stripe: Stripe | null
  checkout: CheckoutPublic
}) => {
  const [pendingHandling, setPendingHandling] = useState(false)
  const [success, setSuccess] = useState(false)
  const { intent_status, intent_client_secret } =
    checkout.paymentProcessorMetadata
  const handleNextAction = useCallback(
    async (stripe: Stripe): Promise<void> => {
      if (success || pendingHandling) {
        return
      }
      setPendingHandling(true)
      if (intent_status === 'requires_action') {
        try {
          await stripe.handleNextAction({
            clientSecret: intent_client_secret,
          })
          setSuccess(true)
        } finally {
          setPendingHandling(false)
        }
      }
    },
    [success, pendingHandling, intent_client_secret, intent_status],
  )

  useEffect(() => {
    if (!stripe) {
      return
    }
    handleNextAction(stripe)
  }, [stripe, handleNextAction, pendingHandling])

  if (!stripe) {
    return null
  }

  if (!success && intent_status === 'requires_action') {
    return (
      <Button
        type="button"
        onClick={() => handleNextAction(stripe)}
        loading={pendingHandling}
      >
        Confirm payment
      </Button>
    )
  }

  return <SpinnerNoMargin className="h-8 w-8" />
}

export interface CheckoutConfirmationProps {
  checkout: CheckoutPublic
  customerSessionToken?: string
  disabled?: boolean
}

export const CheckoutConfirmation = ({
  checkout: _checkout,
  customerSessionToken,
  disabled,
}: CheckoutConfirmationProps) => {
  const client = useMemo(() => new PolarCore({ serverURL: getServerURL() }), [])
  const [checkout, setCheckout] = useState(_checkout)
  const { product, status, organization } = checkout

  const updateCheckout = useCallback(async () => {
    const { ok, value } = await checkoutsCustomClientGet(client, {
      clientSecret: checkout.clientSecret,
    })
    if (ok) {
      setCheckout(value)
    }
  }, [client, checkout])

  const checkoutEvents = useCheckoutClientSSE(checkout.clientSecret)
  useEffect(() => {
    if (disabled || status !== 'confirmed') {
      return
    }
    checkoutEvents.on('checkout.updated', updateCheckout)
    return () => {
      checkoutEvents.off('checkout.updated', updateCheckout)
    }
  }, [disabled, checkout, status, checkoutEvents, updateCheckout])

  return (
    <ShadowBox className="flex w-full max-w-7xl flex-col items-center justify-between gap-y-24 md:px-32 md:py-24">
      <div className="flex w-full max-w-md flex-col gap-y-8">
        {organization.profileSettings?.enabled ? (
          <Link
            href={organizationPageLink(organization)}
            className="flex self-start"
          >
            <Avatar
              className="h-16 w-16"
              avatar_url={organization.avatarUrl}
              name={organization.name}
            />
          </Link>
        ) : (
          <Avatar
            className="h-16 w-16"
            avatar_url={organization.avatarUrl}
            name={organization.name}
          />
        )}
        <h1 className="text-2xl font-medium">
          {status === 'confirmed' && 'We are processing your order'}
          {status === 'succeeded' && 'Your order was successful!'}
          {status === 'failed' &&
            'A problem occurred while processing your order'}
        </h1>
        <p className="dark:text-polar-500 text-gray-500">
          {status === 'confirmed' &&
            'Please wait while we are listening for those webhooks.'}
          {status === 'succeeded' &&
            `You're now eligible for the benefits of ${product.name}.`}
          {status === 'failed' && 'Please try again or contact support.'}
        </p>
        {status === 'confirmed' && (
          <div className="flex items-center justify-center">
            {checkout.paymentProcessor === 'stripe' ? (
              <Elements stripe={stripePromise}>
                <ElementsConsumer>
                  {({ stripe }) => (
                    <StripeRequiresAction stripe={stripe} checkout={checkout} />
                  )}
                </ElementsConsumer>
              </Elements>
            ) : (
              <SpinnerNoMargin className="h-8 w-8" />
            )}
          </div>
        )}
        {status === 'succeeded' && (
          <>
            <CheckoutBenefits
              checkout={checkout}
              customerSessionToken={customerSessionToken}
            />
            <p className="dark:text-polar-500 text-center text-xs text-gray-500">
              This order was processed by our online reseller & Merchant of
              Record, Polar, who also handles order-related inquiries and
              returns.
            </p>
          </>
        )}
      </div>
      <div className="dark:text-polar-500 flex w-full flex-row items-center justify-center gap-x-3 text-sm text-gray-500">
        <span>Powered by</span>
        <LogoType className="h-5" />
      </div>
    </ShadowBox>
  )
}
