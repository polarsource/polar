'use client'

import { useAuth } from '@/hooks'
import { CheckOutlined } from '@mui/icons-material'
import { SubscribeSession } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button } from 'polarkit/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from 'polarkit/components/ui/card'
import { useCallback, useState } from 'react'
import SubscriptionTierCelebration from './SubscriptionTierCelebration'

const mockedBenefits = [
  {
    id: '123',
    summary: 'Badge on Profile',
  },
  {
    id: '456',
    summary: 'Small Logo in README',
  },
  {
    id: '789',
    summary: 'Discord Support Channel',
  },
]

export const SubscriptionSuccess = (props: {
  subscribeSession: SubscribeSession
}) => {
  const { subscribeSession } = props
  const router = useRouter()
  const { currentUser } = useAuth()

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
      <div className="mx-auto flex flex-col gap-16 p-4 md:mt-8 md:w-[768px] md:p-0">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <SubscriptionTierCelebration
            type={subscribeSession.subscription_tier.type}
          />
          <p className="text-muted-foreground">Thank you!</p>
          <h1 className="text-3xl">
            You&apos;re now a {subscribeSession.subscription_tier.name}{' '}
            subscriber
          </h1>
        </div>

        <div className="flex justify-center">
          <Card className="w-full md:w-1/2">
            <CardHeader>
              <CardTitle className="text-xl font-medium">
                Thank you for supporting{' '}
                {subscribeSession.organization_name ||
                  subscribeSession.repository_name}
                !
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                You&apos;re now eligible for the benefits in the{' '}
                {subscribeSession.subscription_tier.name} tier.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-y-1">
              {mockedBenefits.map((benefit) => (
                <div
                  key={benefit.id}
                  className="flex flex-row items-center text-[--var-fg-color] dark:text-[--var-dark-fg-color]"
                >
                  <CheckOutlined className="h-4 w-4" fontSize="small" />
                  <span className="ml-2 text-sm">{benefit.summary}</span>
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex justify-center">
              {currentUser && (
                <Link className="grow" href="/feed">
                  <Button className="w-full">Back to your dashboard</Button>
                </Link>
              )}
              {!currentUser && (
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-sm">
                    You now have an account with Polar! Sign in now to manage
                    your subscriptions and benefits.
                  </p>
                  <Button className="w-full" onClick={onEmailSignin}>
                    Sign in with email
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
