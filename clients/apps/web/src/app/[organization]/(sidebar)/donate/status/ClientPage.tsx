'use client'

import SubscriptionTierCelebration from '@/components/Subscriptions/SubscriptionTierCelebration'
import { useAuth } from '@/hooks/auth'
import { useSendMagicLink } from '@/hooks/magicLink'
import { Organization, SubscriptionTierType } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from 'polarkit/components/ui/atoms/card'
import { useCallback, useState } from 'react'

const ClientPage = ({
  organization,
  email,
}: {
  organization: Organization
  email?: string
}) => {
  const { currentUser } = useAuth()

  const [emailSigninLoading, setEmailSigninLoading] = useState(false)
  const sendMagicLink = useSendMagicLink()

  const router = useRouter()

  const onEmailSignin = useCallback(async () => {
    if (!email) {
      router.push('/login')
      return
    }

    setEmailSigninLoading(true)
    try {
      sendMagicLink(email, `/${organization.name}`)
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
          <SubscriptionTierCelebration type={SubscriptionTierType.INDIVIDUAL} />
          <p className="text-muted-foreground">Thank you!</p>
        </div>

        <div className="flex justify-center">
          <Card className="w-full md:w-1/2">
            <CardHeader>
              <CardTitle className="text-xl font-medium">
                Thank you for donating to{' '}
                {organization.pretty_name || organization.name}!
              </CardTitle>
            </CardHeader>
            <CardFooter className="flex justify-center">
              {currentUser ? (
                <Link className="grow" href={`/${organization.name}`}>
                  <Button className="w-full">Go to {organization.name}</Button>
                </Link>
              ) : (
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

export default ClientPage
