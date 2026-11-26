import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import VersionPage from './VersionPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Version', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
}) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
    params.organization,
  )
  if (!organization.feature_settings?.config_as_code_enabled) {
    notFound()
  }

  return <VersionPage organization={organization} catalogId={params.id} />
}
