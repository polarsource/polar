import Status from '@/components/Pledge/Status'
import { api } from '@/utils/client'
import { resolveRepositoryPath } from '@/utils/repository'
import { unwrap } from '@polar-sh/client'
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

  const pledge = await unwrap(
    api.POST('/v1/pledges', {
      body: {
        payment_intent_id: paymentIntentId,
      },
    }),
    {
      404: notFound,
    },
  )

  const email = searchParams['email'] as string | undefined

  // TODO: Handle different statuses than success... #happy-path-alpha-programming

  return <Status pledge={pledge} organization={organization} email={email} />
}
