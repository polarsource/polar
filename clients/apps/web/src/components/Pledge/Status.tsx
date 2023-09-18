'use client'

import IssueListItem from '@/components/Dashboard/IssueListItem'
import ThankYouUpsell from '@/components/Pledge/ThankYouUpsell'
import { useAuth } from '@/hooks'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { useRouter, useSearchParams } from 'next/navigation'
import { Pledge } from 'polarkit/api/client'
import { PolarTimeAgo } from 'polarkit/components/ui'
import { GrayCard } from 'polarkit/components/ui/Cards'
import { useStore } from 'polarkit/store'
import { useEffect, useRef, useState } from 'react'

export const Status = (props: { pledge: Pledge }) => {
  const search = useSearchParams()

  const pledge = props.pledge

  const { currentUser, reloadUser } = useAuth()
  const didReloadUser = useRef(false)
  const router = useRouter()
  const setLatestPledge = useStore((store) => store.setLatestPledge)
  const [hasCheckedAuth, setCheckedAuth] = useState<boolean>(false)

  useEffect(() => {
    if (currentUser && !didReloadUser.current) {
      didReloadUser.current = true
      // reload user object after successful pledging
      // this us used to grant the user access to polar (alpha/beta) without an invite code
      reloadUser()
    }
    setCheckedAuth(true)
  }, [currentUser, reloadUser])

  const gotoUrl = search?.get('goto_url')

  const redirectToFeed = () => {
    if (!gotoUrl || !gotoUrl.startsWith('/feed')) {
      throw new Error('Invalid goto_url')
    }

    const redirectURL = new URL(window.location.origin + gotoUrl)
    setLatestPledge(pledge, search?.get('redirect_status') || '')
    router.replace(redirectURL.toString())
  }

  if (currentUser && gotoUrl && gotoUrl.startsWith('/feed')) {
    redirectToFeed()
    return <></>
  }

  // TODO: Handle different statuses than success... #happy-path-alpha-programming
  return (
    <>
      <div className="mx-auto p-4 md:mt-24 md:w-[768px] md:p-0">
        <div className="flex flex-row items-center">
          <h1 className="w-1/2 text-2xl font-normal text-gray-800">
            <CheckCircleIcon className="inline-block h-10 w-10 text-blue-500" />{' '}
            Thank you!
          </h1>
          <p className="w-1/2 text-right align-middle text-sm font-normal text-gray-600">
            Backed <PolarTimeAgo date={new Date(pledge.created_at)} />
          </p>
        </div>

        <GrayCard className="mt-6">
          <IssueListItem
            issue={pledge.issue}
            org={pledge.issue.repository.organization}
            repo={pledge.issue.repository}
            pledges={[pledge]}
            references={[]}
            checkJustPledged={false}
            canAddRemovePolarLabel={false}
            showIssueProgress={true}
            showPledgeAction={true}
          />
        </GrayCard>

        {!currentUser && <ThankYouUpsell />}
      </div>
    </>
  )
}

export default Status
