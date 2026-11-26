import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import MigrationsPage from './MigrationsPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Migrations',
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
    params.organization,
  )

  return <MigrationsPage organization={organization} />
}
