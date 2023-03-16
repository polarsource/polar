import type { NextPage } from 'next'
import { api } from 'polarkit'
import { Platforms, type PledgeResources } from 'polarkit/api/client'

const PledgeStatusPage: NextPage = ({
  organization,
  repository,
  issue,
  pledge,
  query,
}: PledgeResources) => {
  return (
    <>
      <div className="container mx-auto mt-24">
        <h1>Status page</h1>
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
