import { CheckCircleIcon } from '@heroicons/react/24/outline'
import type { NextPage } from 'next'
import { api } from 'polarkit'
import { Platforms, type PledgeResources } from 'polarkit/api/client'

import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'
import IssueListItem from 'polarkit/components/IssueListItem'

TimeAgo.addDefaultLocale(en)
const PledgeStatusPage: NextPage = ({
  organization,
  repository,
  issue,
  pledge,
  query,
}: PledgeResources) => {
  return (
    <>
      <div className="mx-auto mt-24 w-[768px]">
        <div className="align-midle flex flex-row">
          <h1 className="w-1/2 text-2xl font-normal text-gray-800">
            <CheckCircleIcon className="inline-block h-10 w-10 text-purple-500" />{' '}
            Thank you!
          </h1>
          <p className="w-1/2 text-right align-middle text-sm font-normal text-gray-600">
            Backed on {pledge.created_at}
          </p>
        </div>

        <IssueListItem
          issue={issue}
          org={organization}
          repo={repository}
          pledges={[pledge]}
        />
        <p>{JSON.stringify(pledge)}</p>
      </div>
    </>
  )
}
PledgeStatusPage.getLayout = (page: ReactElement) => {
  return <div>{page}</div>
}

export const getServerSideProps = async (context) => {
  const res = await api.pledges.getPledgeWithResources({
    platform: Platforms.GITHUB,
    orgName: context.params.organization,
    repoName: context.params.repo,
    number: context.params.number,
    pledgeId: context.query.pledge_id,
    include: 'issue,organization,repository',
  })

  const { organization, repository, issue, pledge } = res
  return {
    props: { organization, repository, issue, pledge, query: context.query },
  }
}

export default PledgeStatusPage
