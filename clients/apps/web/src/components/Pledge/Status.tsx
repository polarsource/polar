'use client'

import IssueListItem from '@/components/Issues/IssueListItem'
import ThankYouUpsell from '@/components/Pledge/ThankYouUpsell'
import { useAuth } from '@/hooks'
import { useSendMagicLink } from '@/hooks/magicLink'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { Pledge } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GrayCard } from 'polarkit/components/ui/Cards'
import { PolarTimeAgo } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { organizationPageLink } from 'polarkit/utils/nav'
import { useCallback, useEffect, useRef, useState } from 'react'

export const Status = (props: {
  pledge: Pledge
  email: string | undefined
}) => {
  const pledge = props.pledge
  const { currentUser, reloadUser } = useAuth()
  const didReloadUser = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (currentUser && !didReloadUser.current) {
      didReloadUser.current = true
      // reload user object after successful pledging
      // this us used to grant the user access to polar (alpha/beta) without an invite code
      reloadUser()
    }
  }, [currentUser, reloadUser])

  const email = props.email
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

  // TODO: Handle different statuses than success... #happy-path-alpha-programming
  return (
    <>
      <div className="mx-auto p-4 md:mt-24 md:w-[768px] md:p-0">
        <div className="flex flex-row items-center">
          <h1 className="dark:text-polar-300 w-1/2 text-2xl font-normal text-gray-800">
            <CheckCircleIcon className="inline-block h-10 w-10 text-blue-500" />{' '}
            Thank you!
          </h1>
          <p className="w-1/2 text-right align-middle text-sm font-normal text-gray-600">
            Backed <PolarTimeAgo date={new Date(pledge.created_at)} />
          </p>
        </div>

        {currentUser ? (
          <div className=" my-8 flex w-full justify-center">
            <Link
              href={organizationPageLink(pledge.issue.repository.organization)}
            >
              <Button>
                Continue to {pledge.issue.repository.organization.name}
              </Button>
            </Link>
          </div>
        ) : null}

        <GrayCard className="mt-6">
          <IssueListItem
            issue={pledge.issue}
            pledges={[pledge]}
            references={[]}
            checkJustPledged={false}
            canAddRemovePolarLabel={false}
            showPledgeAction={true}
          />
        </GrayCard>

        {!currentUser ? (
          <ThankYouUpsell
            onEmailSignin={onEmailSignin}
            emailSigninLoading={emailSigninLoading}
          />
        ) : null}
      </div>
    </>
  )
}

export default Status
