import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DisputeRespondPage from './DisputeRespondPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Counter dispute',
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  if (!organization.feature_settings?.disputes_enabled) {
    notFound()
  }

  return (
    <DisputeRespondPage organization={organization} disputeId={params.id} />
  )
}
