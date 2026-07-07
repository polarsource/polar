import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MigrationDetailPage from './MigrationDetailPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Migration',
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const params = await props.params
  const searchParams = await props.searchParams
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  if (!organization.feature_settings?.merchant_migration_enabled) {
    notFound()
  }

  const error = Array.isArray(searchParams.error)
    ? searchParams.error[0]
    : searchParams.error

  return (
    <MigrationDetailPage
      organization={organization}
      migrationId={params.id}
      error={error}
    />
  )
}
