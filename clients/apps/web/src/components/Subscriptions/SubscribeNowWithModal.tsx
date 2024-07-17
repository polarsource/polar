'use client'

import { useAuth } from '@/hooks/auth'
import { useSendMagicLink } from '@/hooks/magicLink'
import {
  useCreateSubscription,
  useProducts,
  useUserSubscriptions,
} from '@/hooks/queries'
import { captureEvent } from '@/utils/posthog'
import { CheckIcon } from '@heroicons/react/24/outline'
import {
  Organization,
  Product,
  SubscriptionTierType,
  UserSubscription,
} from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { Form, FormField, FormMessage } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import CheckoutCelebration from '../Checkout/CheckoutCelebration'
import { CloseButton, Modal, ModalHeader } from '../Modal'
import { useModal } from '../Modal/useModal'
import Spinner from '../Shared/Spinner'

const SubscribeNowWithModal = ({
  organization,
  isSubscriber,
  children,
}: {
  organization: Organization
  isSubscriber: boolean
  children?: React.ReactNode
}) => {
  const { isShown, hide, show } = useModal()

  const { currentUser } = useAuth()

  const { data: { items: subscriptionTiers } = { items: [] } } = useProducts(
    organization.id,
  )

  const freeSubscriptionTier = subscriptionTiers?.find(
    (tier) => tier.type === SubscriptionTierType.FREE,
  )

  const { data } = useUserSubscriptions({ organizationId: organization.id })
  const subscription = data && data.items && data.items[0]
  const isSubscribed = subscription !== undefined

  const createFreeSubscription = useCreateSubscription()

  const onSubscribeFree = async () => {
    if (!freeSubscriptionTier) {
      return
    }
    await createFreeSubscription.mutateAsync({
      product_id: freeSubscriptionTier.id,
    })
  }

  const [isLoading, setIsLoading] = useState(false)
  const [showAnonymousSubscribe, setShowAnonymousSubscribe] = useState(false)

  const handleClick = async () => {
    setShowAnonymousSubscribe(false)
    setIsLoading(false)

    captureEvent('subscriptions:subscribe_to_modal_open:click')

    if (currentUser) {
      if (isSubscribed) {
        show()
        return
      } else {
        show()
        setIsLoading(true)
        await onSubscribeFree()
        setIsLoading(false)
        return
      }
    } else {
      show()
      setShowAnonymousSubscribe(true)
      return
    }
  }

  return (
    <div className="flex flex-col items-center py-1">
      <Link href={`/${organization.slug}/subscriptions`}>
        {isSubscriber || isSubscribed ? (
          <Button disabled={true}>
            <CheckIcon className="-ml-1 mr-2 h-4 w-4" /> Subscribed
          </Button>
        ) : (
          <Button
            onClick={async (e) => {
              e.stopPropagation()
              e.preventDefault()
              await handleClick()
            }}
            asChild
          >
            <>
              {children ? (
                <>{children}</>
              ) : (
                <>
                  Subscribe to {organization.pretty_name || organization.slug}
                </>
              )}
            </>
          </Button>
        )}
      </Link>
      <Modal
        isShown={isShown}
        hide={hide}
        modalContent={
          <>
            {freeSubscriptionTier ? (
              <>
                {showAnonymousSubscribe ? (
                  <AnonymousSubscribeModalContent
                    hide={hide}
                    organization={organization}
                    freeSubscriptionTier={freeSubscriptionTier}
                  />
                ) : (
                  <LoggedInSubscribeModalContent
                    hide={hide}
                    organization={organization}
                    isSubscribed={isSubscribed}
                    isLoading={isLoading}
                    subscription={subscription}
                  />
                )}
              </>
            ) : (
              <Spinner />
            )}
          </>
        }
      />
    </div>
  )
}

export default SubscribeNowWithModal

const LoggedInSubscribeModalContent = ({
  hide,
  organization,
  isSubscribed,
  isLoading,
  subscription,
}: {
  hide: () => void
  organization: Organization
  isSubscribed: boolean
  isLoading: boolean
  subscription?: UserSubscription
}) => {
  return (
    <>
      <CloseButton hide={hide} className="absolute right-5 top-3" />

      <div className="flex flex-col gap-y-2 p-8">
        {isLoading ? <Spinner /> : null}

        {isSubscribed ? (
          <div className="flex flex-col items-center gap-y-4">
            {subscription ? <CheckoutCelebration /> : null}

            <p className="text-muted-foreground text-center">Thank you!</p>
            <p>
              You&apos;re subscribing to the{' '}
              <span className="font-medium">{subscription?.product.name}</span>{' '}
              tier.
            </p>
            <Link
              href={`/${organization.slug}/subscriptions`}
              className="text-center text-blue-500"
              onClick={() => {
                captureEvent(
                  'posts:subscribe_to_modal_select_different_tier:click',
                )
              }}
            >
              Select a different tier
            </Link>
          </div>
        ) : null}
      </div>
    </>
  )
}

const AnonymousSubscribeModalContent = ({
  hide,
  freeSubscriptionTier,
  organization,
}: {
  hide: () => void
  freeSubscriptionTier: Product
  organization: Organization
}) => {
  const [success, setSuccess] = useState(false)
  const form = useForm<{ customer_email: string }>()
  const { control, handleSubmit } = form

  const [email, setEmail] = useState('')

  const createFreeSubscription = useCreateSubscription()

  const onSubscribeFree: SubmitHandler<{ customer_email: string }> =
    useCallback(
      async (data) => {
        captureEvent(
          'subscriptions:subscribe_modal_email_free_subscribe:submit',
        )

        setSuccess(false)

        await createFreeSubscription.mutateAsync({
          product_id: freeSubscriptionTier.id,
          customer_email: data.customer_email,
        })

        setEmail(data.customer_email)
        setSuccess(true)
      },
      [freeSubscriptionTier, createFreeSubscription],
    )

  const [emailSignInClicked, setEmailSignInClicked] = useState(false)

  const sendMagicLink = useSendMagicLink()

  const onEmailSignin = useCallback(async () => {
    setEmailSignInClicked(true) // set to true, never resets to false

    captureEvent(
      'subscriptions:subscribe_modal_email_free_subscribed_sign_in:click',
    )

    sendMagicLink(email)
  }, [email, sendMagicLink])

  if (success) {
    return (
      <div className="flex flex-col gap-y-2 p-8">
        <div className="flex w-full flex-col items-center justify-center gap-y-6">
          <CloseButton hide={hide} className="absolute right-5 top-3" />

          <CheckoutCelebration />
          <p className="text-muted-foreground text-center">Thank you!</p>
          <h2 className="text-center text-lg">
            You&apos;re now subscribed to {organization.slug}
          </h2>
          <Button
            type="button"
            size="lg"
            disabled={emailSignInClicked}
            loading={emailSignInClicked}
            onClick={onEmailSignin}
          >
            Sign in with email
          </Button>
          <Link
            href={`/${organization.slug}/subscriptions`}
            className="text-center text-blue-400"
            onClick={() => {
              captureEvent(
                'posts:subscribe_to_modal_select_different_tier:click',
              )
            }}
          >
            Show all subscription tiers
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <ModalHeader hide={hide}>
        <h3 className="text-center text-lg font-medium text-gray-950 dark:text-white ">
          Subscribe to {organization.pretty_name || organization.slug}
        </h3>
      </ModalHeader>
      <div className="flex flex-col gap-y-2 p-8">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubscribeFree)} className="w-full">
            <FormField
              control={control}
              name="customer_email"
              rules={{ required: 'Your email is required' }}
              render={({ field }) => {
                return (
                  <div className="flex w-full flex-col gap-2">
                    <div className="flex w-full flex-col items-center gap-y-4 md:flex-row md:gap-x-2 md:gap-y-0">
                      <div className="w-full">
                        <Input
                          {...field}
                          className="h-fit w-full rounded-md px-2.5 py-[5px] text-2xl md:text-base"
                          type="email"
                          placeholder="Email"
                          autoFocus
                        />
                      </div>
                      <Button
                        className="flex h-full md:hidden"
                        size="lg"
                        type="submit"
                        loading={createFreeSubscription.isPending}
                      >
                        Subscribe
                      </Button>
                      <Button
                        className="hidden h-full md:flex"
                        size="sm"
                        type="submit"
                        loading={createFreeSubscription.isPending}
                      >
                        Subscribe
                      </Button>
                    </div>
                    <FormMessage />
                  </div>
                )
              }}
            />
          </form>
        </Form>
      </div>
    </>
  )
}
