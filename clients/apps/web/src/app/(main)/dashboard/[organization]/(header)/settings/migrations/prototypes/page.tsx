import { Metadata } from 'next'
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
  return <MigrationPrototypesPage organizationSlug={organization} />
}
