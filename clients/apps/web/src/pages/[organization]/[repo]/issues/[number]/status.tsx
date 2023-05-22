import IssueListItem from '@/components/Dashboard/IssueListItem'
import ThankYouUpsell from '@/components/Pledge/ThankYouUpsell'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import type { GetServerSideProps, NextLayoutComponentType } from 'next'
import { api } from 'polarkit'
import { Platforms, type PledgeResources } from 'polarkit/api/client'
import { PolarTimeAgo } from 'polarkit/components/ui'
import { GrayCard } from 'polarkit/components/ui/Cards'
import { ReactElement, useEffect, useRef } from 'react'
import { useAuth } from '../../../../../hooks/auth'

const PledgeStatusPage: NextLayoutComponentType = ({
  organization,
  repository,
  issue,
  pledge,
}: PledgeResources) => {
  const { currentUser, reloadUser } = useAuth()
  const didReloadUser = useRef(false)

  useEffect(() => {
    if (currentUser && !didReloadUser.current) {
      didReloadUser.current = true
      // reload user object after successful pledging
      // this us used to grant the user access to polar (alpha/beta) without an invite code
      reloadUser()
    }
  }, [currentUser, reloadUser])

  if (!pledge || !organization || !repository || !issue) {
    return <></>
  }

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
            issue={issue}
            org={organization}
            repo={repository}
            pledges={[pledge]}
            references={[]}
          />
        </GrayCard>

        {!currentUser && <ThankYouUpsell pledge={pledge} />}
      </div>
    </>
  )
}

PledgeStatusPage.getLayout = (page: ReactElement) => {
  return <div>{page}</div>
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  if (
    typeof context?.params?.organization !== 'string' ||
    typeof context?.params?.repo !== 'string' ||
    typeof context?.params?.number !== 'string' ||
    typeof context?.query?.pledge_id !== 'string'
  ) {
    return { props: {} }
  }

  const res = await api.pledges.getPledgeWithResources({
    platform: Platforms.GITHUB,
    orgName: context.params.organization,
    repoName: context.params.repo,
    number: parseInt(context.params.number),
    pledgeId: context.query.pledge_id,
    include: 'issue,organization,repository',
  })

  const { organization, repository, issue, pledge } = res
  return {
    props: { organization, repository, issue, pledge, query: context.query },
  }
}

export default PledgeStatusPage
