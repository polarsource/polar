import Status from '@/components/Pledge/Status'
import { api } from 'polarkit'
import { Platforms } from 'polarkit/api/client'

export default async function Page({
  searchParams,
  params,
}: {
  params: {
    organization: string
    repo: string
    number: string
    pledge_id: string
  }
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const pledgeId = searchParams['pledge_id']
  if (typeof pledgeId !== 'string') {
    return <></>
  }

  const res = await api.pledges.getPledgeWithResources({
    platform: Platforms.GITHUB,
    orgName: params.organization,
    repoName: params.repo,
    number: parseInt(params.number),
    pledgeId: pledgeId,
    include: 'issue,organization,repository',
  })

  const { issue, pledge, organization, repository } = res

  if (!pledge || !organization || !repository || !issue) {
    return <></>
  }

  // TODO: Handle different statuses than success... #happy-path-alpha-programming

  return (
    <Status
      issue={issue}
      pledge={pledge}
      organization={organization}
      repository={repository}
    />
  )
}
