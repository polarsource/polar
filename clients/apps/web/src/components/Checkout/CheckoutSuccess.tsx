'use client'

import { useAuth } from '@/hooks'
import { useSendMagicLink } from '@/hooks/magicLink'
import { Checkout, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from 'polarkit/components/ui/atoms/card'
import { useCallback, useState } from 'react'
import { resolveBenefitIcon } from '../Benefit/utils'
import CheckoutCelebration from './CheckoutCelebration'

export const CheckoutSuccess = (props: {
  checkout: Checkout
  organization: Organization
}) => {
  const {
    checkout: { customer_email: email, product },
    organization,
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
      sendMagicLink(email, `/${organization.slug}`)
    } catch (err) {
      // TODO: error handling
    } finally {
      setEmailSigninLoading(false)
    }
  }, [email, router, organization, sendMagicLink])

  return (
    <>
      <div className="mx-auto flex flex-col gap-16 p-4 md:mt-8 md:w-[768px] md:p-0">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <CheckoutCelebration />
          <p className="text-muted-foreground">Thank you!</p>
          <h1 className="text-3xl">
            Your purchase of {product.name} is complete
          </h1>
        </div>

        <div className="flex justify-center">
          <Card className="w-full md:w-1/2">
            <CardHeader>
              <CardTitle className="text-xl font-medium">
                Thank you for supporting {organization.name}!
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                You&apos;re now eligible for the benefits of {product.name}.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-y-2">
              {product.benefits.map((benefit) => (
                <div
                  key={benefit.id}
                  className="flex flex-row items-start gap-x-3 align-middle"
                >
                  <span className="dark:bg-polar-700 flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-500 dark:text-white">
                    {resolveBenefitIcon(benefit, 'inherit', 'h-3 w-3')}
                  </span>
                  <span className="text-sm">{benefit.description}</span>
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex justify-center">
              {currentUser && (
                <Link className="grow" href={`/purchases`}>
                  <Button className="w-full">Go to purchases</Button>
                </Link>
              )}
              {!currentUser && (
                <div className="flex flex-col gap-4">
                  <p className="text-muted-foreground text-sm">
                    You now have an account with Polar! Sign in now to manage
                    your purchases and benefits.
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

export default CheckoutSuccess
