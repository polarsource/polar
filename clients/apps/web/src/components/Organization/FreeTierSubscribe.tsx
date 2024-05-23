'use client'

import { useAuth } from '@/hooks'
import { useSendMagicLink } from '@/hooks/magicLink'
import {
  useCreateFreeSubscription,
  useProducts,
  useUserSubscriptions,
} from '@/hooks/queries'
import { organizationPageLink } from '@/utils/nav'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { Organization, Product, UserRead } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { Form, FormField, FormMessage } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import CheckoutCelebration from '../Checkout/CheckoutCelebration'
import { Modal } from '../Modal'
import SubscriptionGroupIcon from '../Subscriptions/SubscriptionGroupIcon'

interface AuthenticatedFreeTierSubscribeProps {
  organization: Organization
  product: Product
  user: UserRead
  upsellSubscriptions?: boolean
}

export const AuthenticatedFreeTierSubscribe = ({
  product,
  organization,
  user,
  upsellSubscriptions,
}: AuthenticatedFreeTierSubscribeProps) => {
  const { data, isFetched } = useUserSubscriptions(
    user.id,
    organization.name,
    10,
    organization.platform,
  )
  const subscription = data && data.items && data.items[0]
  const isSubscribed = subscription !== undefined
  const router = useRouter()
  const orgProducts = useProducts(organization.id)
  const hasHighlightedSubscriptions = orgProducts.data?.items?.some(
    (tier) => tier.is_highlighted,
  )

  const createFreeSubscription = useCreateFreeSubscription()

  const onSubscribeFree = async () => {
    await createFreeSubscription.mutateAsync({ tier_id: product.id })

    if (upsellSubscriptions && hasHighlightedSubscriptions) {
      router.push(organizationPageLink(organization, 'subscribe'))
    }
  }

  return (
    <div className="flex w-full">
      {isFetched ? (
        <>
          {isSubscribed ? (
            <Link href="/subscriptions" className="w-full">
              <Button
                loading={createFreeSubscription.isPending}
                fullWidth
                variant="outline"
              >
                <SubscriptionGroupIcon
                  type={subscription?.product.type}
                  className="mr-2"
                />
                Subscribed to {subscription.product.name}
              </Button>
            </Link>
          ) : (
            <Button
              fullWidth
              onClick={onSubscribeFree}
              loading={createFreeSubscription.isPending}
            >
              Subscribe
            </Button>
          )}
        </>
      ) : (
        <Button fullWidth disabled={true} loading={true}>
          Subscribe
        </Button>
      )}
    </div>
  )
}

interface AnonymousFreeTierSubscribeProps {
  organization: Organization
  product: Product
  upsellSubscriptions?: boolean
}

export const AnonymousFreeTierSubscribe = ({
  organization,
  product,
  upsellSubscriptions,
}: AnonymousFreeTierSubscribeProps) => {
  const router = useRouter()

  const orgProducts = useProducts(organization.id)
  const hasHighlightedSubscriptions = orgProducts.data?.items?.some(
    (tier) => tier.is_highlighted,
  )

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
          tier_id: product.id,
          customer_email: data.customer_email,
        })

        // Redirect to /org/subscribe to upsell subscriptions
        if (upsellSubscriptions && hasHighlightedSubscriptions) {
          router.push(
            organizationPageLink(
              organization,
              `subscribe?email=${data.customer_email}`,
            ),
          )
        } else {
          setShowModal(true)
          setEmail(data.customer_email)
          setSuccess(true)
        }
      },
      [
        createFreeSubscription,
        product,
        router,
        organization,
        upsellSubscriptions,
        hasHighlightedSubscriptions,
      ],
    )

  const sendMagicLink = useSendMagicLink()

  const [emailSignInClicked, setEmailSignInClicked] = useState(false)
  const onEmailSignin = useCallback(async () => {
    setEmailSignInClicked(true) // set to true, never resets to false
    sendMagicLink(email)
  }, [email, router])

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
      <Modal
        className="overflow-visible"
        isShown={showModal}
        hide={() => setShowModal(false)}
        modalContent={
          <div className="flex min-h-[240px] w-full flex-col items-center justify-center gap-y-6 px-16 py-10">
            {success && (
              <>
                <CheckoutCelebration />
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
              </>
            )}
          </div>
        }
      />
    </>
  )
}

interface FreeTierSubscribeProps {
  product: Product
  organization: Organization
  upsellSubscriptions?: boolean
}

export const FreeTierSubscribe = ({
  product: product,
  organization,
  upsellSubscriptions,
}: FreeTierSubscribeProps) => {
  const { currentUser } = useAuth()
  return (
    <>
      {currentUser ? (
        <AuthenticatedFreeTierSubscribe
          product={product}
          organization={organization}
          user={currentUser}
          upsellSubscriptions={upsellSubscriptions}
        />
      ) : (
        <AnonymousFreeTierSubscribe
          product={product}
          organization={organization}
          upsellSubscriptions={upsellSubscriptions}
        />
      )}
    </>
  )
}
