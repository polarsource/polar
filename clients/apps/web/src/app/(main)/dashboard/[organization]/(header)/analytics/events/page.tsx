import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import EventsPage from './EventsPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Events', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
    params.organization,
  )

  return <EventsPage organization={organization} />
}
