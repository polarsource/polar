import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { AccountPageRouter } from './AccountPageRouter'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Finance - Payout Account`, // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
    false, // Don't use cache to make sure we get the latest payout account info after onboarding changes
  )

  const { data: reviewStatus } = await api.GET(
    '/v1/organizations/{id}/review-status',
    { params: { path: { id: organization.id } } },
  )

  return (
    <AccountPageRouter
      organization={organization}
      initialReviewStatus={reviewStatus}
    />
  )
}
