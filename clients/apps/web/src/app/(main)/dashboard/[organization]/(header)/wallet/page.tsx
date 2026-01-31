import { getServerSideAPI } from '@/utils/server-api'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export const metadata: Metadata = {
  title: 'Wallet',
  description: 'Manage your treasury account, cards, and transactions',
}

export default async function Page({
  params,
}: {
  params: Promise<{ organization: string }>
}) {
  const api = await getServerSideAPI()
  const { organization: organizationSlug } = await params

  return <ClientPage organizationSlug={organizationSlug} />
}
