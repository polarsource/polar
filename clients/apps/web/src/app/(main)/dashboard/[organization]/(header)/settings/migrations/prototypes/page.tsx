import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MigrationPrototypesPage from './MigrationPrototypesPage'

export const metadata: Metadata = {
  title: 'Migration experience prototypes',
}

export default async function Page({
  params,
}: {
  params: Promise<{ organization: string }>
}) {
  const { organization } = await params
  const api = await getServerSideAPI()
  const organizationData = await getOrganizationBySlugOrNotFound(
    api,
    organization,
  )
  if (!organizationData.feature_settings?.merchant_migration_enabled) {
    notFound()
  }
  return <MigrationPrototypesPage organizationSlug={organization} />
}
