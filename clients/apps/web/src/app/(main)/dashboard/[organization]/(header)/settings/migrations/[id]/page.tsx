import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import MigrationDetailPage from './MigrationDetailPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Migration',
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
}) {
  const params = await props.params
  await getOrganizationBySlugOrNotFound(params.organization)

  return <MigrationDetailPage migrationId={params.id} />
}
