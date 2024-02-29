'use client'

import { useAuth } from '@/hooks'
import { organizationPageLink } from '@/utils/nav'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { Organization, SubscriptionTier, UserRead } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Input } from 'polarkit/components/ui/atoms'
import { Form, FormField, FormMessage } from 'polarkit/components/ui/form'
import { useCreateFreeSubscription, useUserSubscriptions } from 'polarkit/hooks'
import { useCallback } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import SubscriptionGroupIcon from '../Subscriptions/SubscriptionGroupIcon'

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
        <Link href="/subscriptions" className="w-full">
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

  const form = useForm<{ customer_email: string }>()
  const { control, handleSubmit } = form

  const createFreeSubscription = useCreateFreeSubscription()

  const onSubscribeFree: SubmitHandler<{ customer_email: string }> =
    useCallback(
      async (data) => {
        await createFreeSubscription.mutateAsync({
          tier_id: subscriptionTier.id,
          customer_email: data.customer_email,
        })

        router.push(
          organizationPageLink(
            organization,
            `subscribe?email=${data.customer_email}`,
          ),
        )
      },
      [createFreeSubscription, subscriptionTier, router, organization],
    )

  return (
    <>
      <div className="flex w-full">
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
                    <div className="flex w-full flex-row items-center gap-x-1 space-x-1">
                      <Input
                        {...field}
                        className="h-fit rounded-full bg-transparent px-4 py-2 text-sm"
                        type="email"
                        placeholder="Subscribe with Email..."
                      />
                      <Button
                        className="aspect-square h-8"
                        size="sm"
                        type="submit"
                        loading={createFreeSubscription.isPending}
                      >
                        <ArrowForwardOutlined fontSize="inherit" />
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
