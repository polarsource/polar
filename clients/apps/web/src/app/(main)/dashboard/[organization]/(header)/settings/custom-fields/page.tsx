import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
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

  if (organization.feature_settings?.config_as_code_enabled) {
    redirect(`/dashboard/${organization.slug}/products/custom-fields`)
  }

  return <CustomFieldsPage organization={organization} />
}
