import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlug } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

export async function generateMetadata({
  params,
}: {
  params: { organization: string }
}): Promise<Metadata> {
  return {
    title: `Embeds for ${params.organization}`,
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlug(api, params.organization)

  if (!organization) {
    notFound()
  }

  return <ClientPage organization={organization} />
}
