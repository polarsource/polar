import Status from '@/components/Pledge/Status'
import { api } from '@/utils/api'
import { resolveRepositoryPath } from '@/utils/repository'
import { Pledge, ResponseError } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'

const cacheConfig = {
  cache: 'no-store',
} as const

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string; repo: string; number: string }
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const resolvedRepositoryOrganization = await resolveRepositoryPath(
    api,
    params.organization,
    params.repo,
    cacheConfig,
  )

  if (!resolvedRepositoryOrganization) {
    notFound()
  }

  const [, organization] = resolvedRepositoryOrganization

  const paymentIntentId = searchParams['payment_intent_id']
  if (typeof paymentIntentId !== 'string') {
    notFound()
  }

  let pledge: Pledge

  try {
    pledge = await api.pledges.create({
      body: {
        payment_intent_id: paymentIntentId,
      },
    })
  } catch (e) {
    if (e instanceof ResponseError) {
      if (e.response.status === 404) {
        notFound()
      }
    }
    throw e
  }

  const email = searchParams['email'] as string | undefined

  // TODO: Handle different statuses than success... #happy-path-alpha-programming

  return <Status pledge={pledge} organization={organization} email={email} />
}
