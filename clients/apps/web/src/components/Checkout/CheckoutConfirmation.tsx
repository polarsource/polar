'use client'

import { useAuth } from '@/hooks'
import { useSendMagicLink } from '@/hooks/magicLink'
import { api } from '@/utils/api'
import { CheckoutPublic, CheckoutStatus, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useCallback, useEffect, useState } from 'react'
import LogoType from '../Brand/LogoType'
import { SpinnerNoMargin } from '../Shared/Spinner'
import { CheckoutCard } from './CheckoutCard'

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

  useEffect(() => {
    if (disabled) {
      return
    }
    let interval = window.setInterval(async () => {
      const updatedCheckout = await api.checkouts.clientGet({
        clientSecret: checkout.client_secret,
      })
      setCheckout(updatedCheckout)
    }, 1000)
    return () => clearInterval(interval)
  }, [checkout, disabled])

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
        <CheckoutCard organization={organization} product={product} />
        {status === CheckoutStatus.CONFIRMED && (
          <div className="flex items-center justify-center">
            <SpinnerNoMargin className="h-8 w-8" />
          </div>
        )}
        {status === CheckoutStatus.SUCCEEDED && (
          <>
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
