'use client'

import { useAuth } from '@/hooks'
import { useSendMagicLink } from '@/hooks/magicLink'
import { useLicenseKey } from '@/hooks/queries'
import { useCheckoutClientSSE } from '@/hooks/sse'
import { api } from '@/utils/api'
import { ContentPasteOutlined } from '@mui/icons-material'
import {
  BenefitPublicInner,
  CheckoutPublic,
  CheckoutStatus,
  Organization,
} from '@polar-sh/sdk'
import { Elements, ElementsConsumer } from '@stripe/react-stripe-js'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useCallback, useEffect, useState } from 'react'
import LogoType from '../Brand/LogoType'
import { SpinnerNoMargin } from '../Shared/Spinner'
import { CheckoutCard } from './CheckoutCard'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')

const StripeRequiresAction = ({
  stripe,
  checkout,
  updateCheckout,
}: {
  stripe: Stripe | null
  checkout: CheckoutPublic
  updateCheckout: () => Promise<void>
}) => {
  const [pendingHandling, setPendingHandling] = useState(false)
  const { payment_intent_status, payment_intent_client_secret } =
    checkout.payment_processor_metadata as Record<string, string>
  const handleNextAction = useCallback(
    async (stripe: Stripe): Promise<void> => {
      setPendingHandling(true)
      if (payment_intent_status === 'requires_action') {
        try {
          await stripe.handleNextAction({
            clientSecret: payment_intent_client_secret,
          })
        } catch {
        } finally {
          await updateCheckout()
          setPendingHandling(false)
        }
      }
    },
    [payment_intent_client_secret, payment_intent_status, updateCheckout],
  )

  useEffect(() => {
    if (!stripe) {
      return
    }
    handleNextAction(stripe)
  }, [stripe, handleNextAction])

  if (!stripe) {
    return null
  }

  if (payment_intent_status === 'requires_action') {
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
  organization: Organization
  disabled?: boolean
}

export const CheckoutConfirmation = ({
  checkout: _checkout,
  organization,
  disabled,
}: CheckoutConfirmationProps) => {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [checkout, setCheckout] = useState(_checkout)
  const { customer_email: email, product, status } = checkout

  const updateCheckout = useCallback(async () => {
    const updatedCheckout = await api.checkouts.clientGet({
      clientSecret: checkout.client_secret,
    })
    setCheckout(updatedCheckout)
  }, [checkout])

  const checkoutEvents = useCheckoutClientSSE(checkout.client_secret)
  useEffect(() => {
    if (disabled || status !== CheckoutStatus.CONFIRMED) {
      return
    }
    checkoutEvents.on('checkout.updated', updateCheckout)
    return () => {
      checkoutEvents.off('checkout.updated', updateCheckout)
    }
  }, [disabled, checkout, status, checkoutEvents, updateCheckout])

  const [emailSigninLoading, setEmailSigninLoading] = useState(false)
  const sendMagicLink = useSendMagicLink()

  const onEmailSignin = useCallback(async () => {
    if (!email) {
      router.push('/login')
      return
    }

    setEmailSigninLoading(true)
    try {
      sendMagicLink(email, `/${organization.slug}`)
    } catch (err) {
      // TODO: error handling
    } finally {
      setEmailSigninLoading(false)
    }
  }, [email, router, organization, sendMagicLink])

  console.dir(checkout, { depth: Infinity })

  return (
    <ShadowBox className="flex w-full max-w-7xl flex-col items-center justify-between gap-y-24 md:px-32 md:py-24">
      <div className="flex w-full max-w-sm flex-col gap-y-8">
        {!organization.profile_settings?.enabled && (
          <Avatar
            className="h-24 w-24"
            avatar_url={organization.avatar_url}
            name={organization.name}
          />
        )}

        <h1 className="text-2xl font-medium">
          {status === CheckoutStatus.CONFIRMED &&
            'We are processing your order'}
          {status === CheckoutStatus.SUCCEEDED && 'Your order was successful!'}
          {status === CheckoutStatus.FAILED &&
            'A problem occurred while processing your order'}
        </h1>
        <p className="dark:text-polar-500 text-gray-500">
          {status === CheckoutStatus.CONFIRMED &&
            'Please wait while we are listening for those webhooks.'}
          {status === CheckoutStatus.SUCCEEDED &&
            `You're now eligible for the benefits of ${product.name}.`}
          {status === CheckoutStatus.FAILED &&
            'Please try again or contact support.'}
        </p>
        <CheckoutCard checkout={checkout} disabled />
        {status === CheckoutStatus.CONFIRMED && (
          <div className="flex items-center justify-center">
            {checkout.payment_processor === 'stripe' ? (
              <Elements stripe={stripePromise}>
                <ElementsConsumer>
                  {({ stripe }) => (
                    <StripeRequiresAction
                      stripe={stripe}
                      checkout={checkout}
                      updateCheckout={updateCheckout}
                    />
                  )}
                </ElementsConsumer>
              </Elements>
            ) : (
              <SpinnerNoMargin className="h-8 w-8" />
            )}
          </div>
        )}
        {status === CheckoutStatus.SUCCEEDED && (
          <>
            {licenseKeyBenefit && (
              <LicenseKeyBenefit benefit={licenseKeyBenefit} />
            )}
            {currentUser ? (
              <Link className="grow" href={disabled ? '#' : `/purchases`}>
                <Button className="w-full" size="lg" disabled={disabled}>
                  Access your purchase
                </Button>
              </Link>
            ) : (
              <div className="flex flex-col gap-y-6">
                <p className="dark:text-polar-500 text-gray-500">
                  You now have an account with Polar! Sign in now to manage your
                  purchases and benefits.
                </p>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={onEmailSignin}
                  loading={emailSigninLoading}
                  disabled={disabled}
                >
                  Verify Email
                </Button>
              </div>
            )}
            <p className="dark:text-polar-600 text-center text-xs text-gray-400">
              This order was processed by our online reseller & Merchant of
              Record, Polar, who also handles order-related inquiries and
              returns.
            </p>
          </>
        )}
      </div>
      <div className="dark:text-polar-600 flex w-full flex-row items-center justify-center gap-x-3 text-sm text-gray-400">
        <span>Powered by</span>
        <LogoType className="h-5" />
      </div>
    </ShadowBox>
  )
}

const LicenseKeyBenefit = ({ benefit }: { benefit: BenefitPublicInner }) => {
  if (benefit.type !== 'license_keys') {
    return <></>
  }

  console.log(benefit)

  const grant = benefit.grants[0]
  const licenseKeyId = grant.properties.license_key_id
  const licenseKeyQuery = useLicenseKey({ licenseKeyId })
  const licenseKey = licenseKeyQuery.data

  const onCopyKey = useCallback(() => {
    navigator.clipboard.writeText(licenseKey?.key ?? '')
  }, [licenseKey])

  if (licenseKeyQuery.isLoading) {
    // TODO: Style me
    return <div>Loading...</div>
  }

  if (!licenseKey) {
    return <></>
  }

  return (
    <div className="flex w-full flex-col gap-y-6">
      <div className="flex flex-row items-center space-x-2">
        <Input value={licenseKey.key} readOnly />
        <Button
          size="icon"
          variant="secondary"
          className="h-10 w-10"
          onClick={onCopyKey}
        >
          <ContentPasteOutlined fontSize="inherit" />
        </Button>
      </div>
    </div>
  )
}
