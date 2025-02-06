import { getServerSideAPI } from '@/utils/api/serverside'
import { getServerSideAPI as getNewServerSideAPI } from '@/utils/client/serverside'
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
  const meter = await api.meters.get({ id: params.id })

  return {
    title: `Edit ${meter.name}`,
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string; id: string }
}) {
  const newAPI = getNewServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    newAPI,
    params.organization,
  )
  const api = getServerSideAPI()
  const meter = await getMeterById(api, params.id)

  return <ClientPage organization={organization} meter={meter} />
}
