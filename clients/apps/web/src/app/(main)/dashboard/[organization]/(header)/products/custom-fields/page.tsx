import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import CustomFieldsPage from './CustomFieldsPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Custom Fields', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
    params.organization,
  )

  return <CustomFieldsPage organization={organization} />
}
