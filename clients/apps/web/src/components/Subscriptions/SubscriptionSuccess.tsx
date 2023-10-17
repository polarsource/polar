'use client'

import ThankYouUpsell from '@/components/Subscriptions/ThankYouUpsell'
import { useAuth } from '@/hooks'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { SubscribeSession } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { useCallback, useState } from 'react'

export const SubscriptionSuccess = (props: {
  subscribeSession: SubscribeSession
}) => {
  const { subscribeSession } = props
  const router = useRouter()
  const { currentUser, reloadUser } = useAuth()

  const email = subscribeSession.customer_email
  const [emailSigninLoading, setEmailSigninLoading] = useState(false)
  const onEmailSignin = useCallback(async () => {
    if (!email) {
      router.push('/login')
      return
    }

    setEmailSigninLoading(true)
    try {
      await api.magicLink.requestMagicLink({ magicLinkRequest: { email } })
      const searchParams = new URLSearchParams({ email: email })
      router.push(`/login/magic-link/request?${searchParams}`)
    } catch (err) {
      // TODO: error handling
    } finally {
      setEmailSigninLoading(false)
    }
  }, [email, router])

  return (
    <>
      <div className="mx-auto p-4 md:mt-24 md:w-[768px] md:p-0">
        <div className="flex flex-row items-center">
          <h1 className="dark:text-polar-300 w-1/2 text-2xl font-normal text-gray-800">
            <CheckCircleIcon className="inline-block h-10 w-10 text-blue-500" />{' '}
            Thank you!
          </h1>
          <p className="w-1/2 text-right align-middle text-sm font-normal text-gray-600">
            You&apos;re now subscribed to{' '}
            {subscribeSession.subscription_tier.name}
          </p>
        </div>

        {true && (
          <ThankYouUpsell
            onEmailSignin={onEmailSignin}
            emailSigninLoading={emailSigninLoading}
          />
        )}
      </div>
    </>
  )
}

export default SubscriptionSuccess
