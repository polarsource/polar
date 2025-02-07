import { getServerSideAPI } from '@/utils/client/serverside'
import { getMeterById } from '@/utils/meter'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const api = getServerSideAPI()
  const meter = await getMeterById(api, params.id)

  return {
    title: meter.name,
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string; id: string }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  const meter = await getMeterById(api, params.id)

  return <ClientPage organization={organization} meter={meter} />
}
