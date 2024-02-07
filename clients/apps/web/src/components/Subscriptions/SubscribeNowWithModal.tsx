import { useAuth } from '@/hooks/auth'
import { captureEvent } from '@/utils/posthog'
import { CheckIcon } from '@heroicons/react/24/outline'
import {
  Organization,
  SubscriptionSubscriber,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit/api'
import { Button, Input } from 'polarkit/components/ui/atoms'
import { Form, FormField, FormMessage } from 'polarkit/components/ui/form'
import {
  useCreateFreeSubscription,
  useSubscriptionTiers,
  useUserSubscriptions,
} from 'polarkit/hooks'
import { useCallback, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { Modal, ModalHeader } from '../Modal'
import { useModal } from '../Modal/useModal'
import Spinner from '../Shared/Spinner'
import SubscriptionTierCelebration from './SubscriptionTierCelebration'

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

  const { data: { items: subscriptionTiers } = { items: [] } } =
    useSubscriptionTiers(organization.name, 100)

  const freeSubscriptionTier = subscriptionTiers?.find(
    (tier) => tier.type === SubscriptionTierType.FREE,
  )

  const { data } = useUserSubscriptions(
    currentUser?.id,
    organization.name,
    10,
    organization.platform,
  )
  const subscription = data && data.items && data.items[0]
  const isSubscribed = subscription !== undefined

  const createFreeSubscription = useCreateFreeSubscription()

  const onSubscribeFree = async () => {
    if (!freeSubscriptionTier) {
      return
    }
    await createFreeSubscription.mutateAsync({
      tier_id: freeSubscriptionTier.id,
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
      <Link href={`/${organization.name}/subscriptions`}>
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
                  Subscribe to {organization.pretty_name || organization.name}
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
              <SubscribeNowModal
                hide={hide}
                organization={organization}
                isSubscribed={isSubscribed}
                isLoading={isLoading}
                showAnonymousSubscribe={showAnonymousSubscribe}
                subscription={subscription}
                freeSubscriptionTier={freeSubscriptionTier}
              />
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

const SubscribeNowModal = ({
  hide,
  organization,
  isSubscribed,
  isLoading,
  showAnonymousSubscribe,
  subscription,
  freeSubscriptionTier,
}: {
  hide: () => void
  organization: Organization
  isSubscribed: boolean
  isLoading: boolean
  showAnonymousSubscribe: boolean
  subscription?: SubscriptionSubscriber
  freeSubscriptionTier: SubscriptionTier
}) => {
  return (
    <>
      <ModalHeader hide={hide}>
        <h3 className="dark:text-polar-50 text-center text-lg font-medium text-gray-950 ">
          Subscribe to {organization.pretty_name || organization.name}
        </h3>
      </ModalHeader>
      <div className="p-8">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            {isLoading ? <Spinner /> : null}

            {isSubscribed ? (
              <div className="flex flex-col items-center gap-y-4">
                {subscription ? (
                  <SubscriptionTierCelebration
                    type={subscription?.subscription_tier.type}
                  />
                ) : null}

                <p className="text-muted-foreground text-center">Thank you!</p>
                <p>
                  You&apos;re subscribing to the{' '}
                  <span className="font-medium">
                    {subscription?.subscription_tier.name}
                  </span>{' '}
                  tier.
                </p>
                <Link
                  href={`/${organization.name}/subscriptions`}
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

            {showAnonymousSubscribe ? (
              <AnonymousSubscribeForm
                subscriptionTier={freeSubscriptionTier}
                organization={organization}
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}

const AnonymousSubscribeForm = ({
  subscriptionTier,
  organization,
}: {
  subscriptionTier: SubscriptionTier
  organization: Organization
}) => {
  const router = useRouter()

  const [success, setSuccess] = useState(false)
  const form = useForm<{ customer_email: string }>()
  const { control, handleSubmit } = form

  const [email, setEmail] = useState('')

  const createFreeSubscription = useCreateFreeSubscription()

  const onSubscribeFree: SubmitHandler<{ customer_email: string }> =
    useCallback(
      async (data) => {
        captureEvent(
          'subscriptions:subscribe_modal_email_free_subscribe:submit',
        )

        setSuccess(false)

        await createFreeSubscription.mutateAsync({
          tier_id: subscriptionTier.id,
          customer_email: data.customer_email,
        })

        setEmail(data.customer_email)
        setSuccess(true)
      },
      [subscriptionTier, createFreeSubscription],
    )

  const [emailSignInClicked, setEmailSignInClicked] = useState(false)
  const onEmailSignin = useCallback(async () => {
    setEmailSignInClicked(true) // set to true, never resets to false

    captureEvent(
      'subscriptions:subscribe_modal_email_free_subscribed_sign_in:click',
    )

    await api.magicLink.magicLinkRequest({ magicLinkRequest: { email } })
    const searchParams = new URLSearchParams({ email: email })
    router.push(`/login/magic-link/request?${searchParams}`)
  }, [email, router])

  if (success) {
    return (
      <div className="flex  w-full flex-col items-center justify-center gap-y-6">
        <SubscriptionTierCelebration type={subscriptionTier.type} />
        <p className="text-muted-foreground text-center">Thank you!</p>
        <h2 className="text-center text-lg">
          You&apos;re now subscribed to {organization.name}
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
          href={`/${organization.name}/subscriptions`}
          className="text-center text-blue-400"
          onClick={() => {
            captureEvent('posts:subscribe_to_modal_select_different_tier:click')
          }}
        >
          Show all subscription tiers
        </Link>
      </div>
    )
  }

  return (
    <div className="flex w-full">
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubscribeFree)} className="w-full">
          <FormField
            control={control}
            name="customer_email"
            rules={{ required: 'Your email is required' }}
            render={({ field }) => {
              return (
                <div className="flex w-full flex-col gap-2">
                  <div className="flex w-full flex-col items-center gap-y-2 md:flex-row md:gap-x-2 md:gap-y-0">
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
  )
}
