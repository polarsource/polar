import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import CostsPage from './CostsPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Costs', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
    params.organization,
  )

  return <CostsPage organization={organization} />
}
