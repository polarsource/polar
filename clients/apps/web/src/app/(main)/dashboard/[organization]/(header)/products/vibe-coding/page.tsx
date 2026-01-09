import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Prompt Generator', // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return <ClientPage organization={organization} />
}
