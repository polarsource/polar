import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MigrationsPage from './MigrationsPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Migrations',
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const [params, api] = await Promise.all([props.params, getServerSideAPI()])
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  if (!organization.feature_settings?.merchant_migration_enabled) {
    notFound()
  }

  return <MigrationsPage organization={organization} />
}
