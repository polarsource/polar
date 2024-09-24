'use client'

import { useAuth } from '@/hooks'
import { useSendMagicLink } from '@/hooks/magicLink'
import { Checkout, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useCallback, useState } from 'react'
import LogoType from '../Brand/LogoType'
import { CheckoutCard } from './CheckoutCard'

export interface ConfirmationProps {
  checkout: Checkout
  organization: Organization
  disabled?: boolean
}

export const Confirmation = ({
  checkout: { customer_email: email, product, ...checkout },
  organization,
  disabled,
}: ConfirmationProps) => {
  const router = useRouter()
  const { currentUser } = useAuth()

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

  return (
    <ShadowBox className="flex w-full max-w-7xl flex-col items-center justify-between gap-y-24 md:px-32 md:py-24">
      <div className="flex w-full max-w-sm flex-col gap-y-8">
        <Avatar
          className="h-24 w-24"
          avatar_url={organization.avatar_url}
          name={organization.name}
        />

        <h1 className="text-2xl font-medium">Your order was successful!</h1>
        <p className="dark:text-polar-500 text-gray-500">
          You&apos;re now eligible for the benefits of {product.name}.
        </p>
        <CheckoutCard organization={organization} product={product} />
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
          This order was processed by our online reseller & Merchant of Record,
          Polar, who also handles order-related inquiries and returns.
        </p>
      </div>
      <div className="dark:text-polar-600 flex w-full flex-row items-center justify-center gap-x-3 text-sm text-gray-400">
        <span>Powered by</span>
        <LogoType className="h-5" />
      </div>
    </ShadowBox>
  )
}
