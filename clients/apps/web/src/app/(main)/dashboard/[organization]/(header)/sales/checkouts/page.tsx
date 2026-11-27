import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import CheckoutsPage from './CheckoutsPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Checkouts', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
    params.organization,
  )

  return <CheckoutsPage organization={organization} />
}
