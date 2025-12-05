import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import CostsEventPage from './CostsEventPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Event', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; eventId: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return <CostsEventPage organization={organization} eventId={params.eventId} />
}
