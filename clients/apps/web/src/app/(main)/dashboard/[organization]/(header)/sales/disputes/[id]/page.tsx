import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import DisputeDetailPage from './DisputeDetailPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Dispute',
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

  return <DisputeDetailPage organization={organization} disputeId={params.id} />
}
