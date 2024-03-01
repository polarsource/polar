'use client'

import { useAuth } from '@/hooks'
import { useSendMagicLink } from '@/hooks/magicLink'
import { SubscribeSession } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from 'polarkit/components/ui/atoms'
import { useCallback, useState } from 'react'
import SubscriptionTierCelebration from './SubscriptionTierCelebration'
import { resolveBenefitIcon } from './utils'

export const SubscriptionSuccess = (props: {
  subscribeSession: SubscribeSession
}) => {
  const {
    subscribeSession: {
      customer_email: email,
      organization_name: organizationName,
      repository_name: repositoryName,
      subscription_tier: subscriptionTier,
    },
  } = props
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
      sendMagicLink(email)
    } catch (err) {
      // TODO: error handling
    } finally {
      setEmailSigninLoading(false)
    }
  }, [email, router])

  return (
    <>
      <div className="mx-auto flex flex-col gap-16 p-4 md:mt-8 md:w-[768px] md:p-0">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <SubscriptionTierCelebration type={subscriptionTier.type} />
          <p className="text-muted-foreground">Thank you!</p>
          <h1 className="text-3xl">
            You&apos;re now a {subscriptionTier.name} subscriber
          </h1>
        </div>

        <div className="flex justify-center">
          <Card className="w-full md:w-1/2">
            <CardHeader>
              <CardTitle className="text-xl font-medium">
                Thank you for supporting {organizationName || repositoryName}!
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                You&apos;re now eligible for the benefits in the{' '}
                {subscriptionTier.name} tier.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-y-1">
              {subscriptionTier.benefits.map((benefit) => (
                <div
                  key={benefit.id}
                  className="flex flex-row items-start text-blue-500 dark:text-blue-400"
                >
                  <span className="flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full bg-blue-50 text-[14px] dark:bg-blue-950">
                    {resolveBenefitIcon(benefit, 'inherit')}
                  </span>
                  <span className="ml-2 text-sm leading-relaxed">
                    {benefit.description}
                  </span>
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex justify-center">
              {currentUser && (
                <Link className="grow" href={`/${organizationName}`}>
                  <Button className="w-full">Go to {organizationName}</Button>
                </Link>
              )}
              {!currentUser && (
                <div className="flex flex-col gap-4">
                  <p className="text-muted-foreground text-sm">
                    You now have an account with Polar! Sign in now to manage
                    your subscriptions and benefits.
                  </p>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={onEmailSignin}
                    loading={emailSigninLoading}
                  >
                    Verify Email
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  )
}

export default SubscriptionSuccess
