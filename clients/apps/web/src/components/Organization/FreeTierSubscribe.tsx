'use client'

import { useAuth } from '@/hooks'
import { Organization, SubscriptionTier, UserRead } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button, Input } from 'polarkit/components/ui/atoms'
import { Form, FormField, FormMessage } from 'polarkit/components/ui/form'
import { useCreateFreeSubscription, useUserSubscriptions } from 'polarkit/hooks'
import { useCallback, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { Modal } from '../Modal'
import SubscriptionGroupIcon from '../Subscriptions/SubscriptionGroupIcon'
import SubscriptionTierCelebration from '../Subscriptions/SubscriptionTierCelebration'

interface AuthenticatedFreeTierSubscribeProps {
  organization: Organization
  subscriptionTier: SubscriptionTier
  user: UserRead
}

export const AuthenticatedFreeTierSubscribe = ({
  subscriptionTier,
  organization,
  user,
}: AuthenticatedFreeTierSubscribeProps) => {
  const { data } = useUserSubscriptions(
    user.id,
    organization.name,
    10,
    organization.platform,
  )
  const subscription = data && data.items && data.items[0]
  const isSubscribed = subscription !== undefined

  const createFreeSubscription = useCreateFreeSubscription()

  const onSubscribeFree = async () => {
    await createFreeSubscription.mutateAsync({ tier_id: subscriptionTier.id })
  }

  return (
    <div className="flex w-full">
      {!isSubscribed && (
        <Button
          fullWidth
          onClick={onSubscribeFree}
          loading={createFreeSubscription.isPending}
        >
          Subscribe
        </Button>
      )}
      {isSubscribed && (
        <Link href="/settings" className="w-full">
          <Button
            loading={createFreeSubscription.isPending}
            fullWidth
            variant="outline"
          >
            <SubscriptionGroupIcon
              type={subscription?.subscription_tier.type}
              className="mr-2"
            />
            Subscribed to {subscription.subscription_tier.name}
          </Button>
        </Link>
      )}
    </div>
  )
}

interface AnonymousFreeTierSubscribeProps {
  organization: Organization
  subscriptionTier: SubscriptionTier
}

export const AnonymousFreeTierSubscribe = ({
  organization,
  subscriptionTier,
}: AnonymousFreeTierSubscribeProps) => {
  const router = useRouter()

  const [showModal, setShowModal] = useState(false)
  const [success, setSuccess] = useState(false)
  const form = useForm<{ customer_email: string }>()
  const { control, handleSubmit } = form

  const [email, setEmail] = useState('')

  const createFreeSubscription = useCreateFreeSubscription()

  const onSubscribeFree: SubmitHandler<{ customer_email: string }> =
    useCallback(
      async (data) => {
        setSuccess(false)

        await createFreeSubscription.mutateAsync({
          tier_id: subscriptionTier.id,
          customer_email: data.customer_email,
        })

        setEmail(data.customer_email)
        setSuccess(true)
      },
      [subscriptionTier],
    )

  const [emailSignInClicked, setEmailSignInClicked] = useState(false)
  const onEmailSignin = useCallback(async () => {
    setEmailSignInClicked(true) // set to true, never resets to false

    await api.magicLink.magicLinkRequest({ magicLinkRequest: { email } })
    const searchParams = new URLSearchParams({ email: email })
    router.push(`/login/magic-link/request?${searchParams}`)
  }, [email, router])

  return (
    <>
      <div className="flex w-full">
        <Button className="grow" onClick={() => setShowModal(true)}>
          Subscribe
        </Button>
      </div>
      <Modal
        className="overflow-visible"
        isShown={showModal}
        hide={() => setShowModal(false)}
        modalContent={
          <div className="flex min-h-[240px] w-full flex-col items-center justify-center gap-y-6 px-16 py-10">
            {!success && (
              <>
                <div className="flex flex-col items-center text-center">
                  <h2 className="text-lg">Subscribe to {organization.name}</h2>
                </div>
                <Form {...form}>
                  <form
                    onSubmit={handleSubmit(onSubscribeFree)}
                    className="w-full max-w-lg"
                  >
                    <FormField
                      control={control}
                      name="customer_email"
                      rules={{ required: 'Your email is required' }}
                      render={({ field }) => {
                        return (
                          <div className="flex w-full flex-col gap-2">
                            <div className="flex w-full flex-col items-center gap-4 space-x-2 md:flex-row">
                              <Input
                                {...field}
                                type="email"
                                placeholder="Type your email..."
                              />
                              <Button
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
              </>
            )}
            {success && (
              <>
                <SubscriptionTierCelebration type={subscriptionTier.type} />
                <p className="text-muted-foreground">Thank you!</p>
                <h2 className="text-lg">
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
              </>
            )}
          </div>
        }
      />
    </>
  )
}

interface FreeTierSubscribeProps {
  subscriptionTier: SubscriptionTier
  organization: Organization
}

export const FreeTierSubscribe = ({
  subscriptionTier,
  organization,
}: FreeTierSubscribeProps) => {
  const { currentUser } = useAuth()
  return (
    <>
      {currentUser ? (
        <AuthenticatedFreeTierSubscribe
          subscriptionTier={subscriptionTier}
          organization={organization}
          user={currentUser}
        />
      ) : (
        <AnonymousFreeTierSubscribe
          subscriptionTier={subscriptionTier}
          organization={organization}
        />
      )}
    </>
  )
}
