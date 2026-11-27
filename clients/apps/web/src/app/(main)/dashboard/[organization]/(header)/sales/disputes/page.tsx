import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DisputesPage from './DisputesPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Disputes',
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
    params.organization,
  )

  if (!organization.feature_settings?.disputes_enabled) {
    notFound()
  }

  return <DisputesPage organization={organization} />
}
