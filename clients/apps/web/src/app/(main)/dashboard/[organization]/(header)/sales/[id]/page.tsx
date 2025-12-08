import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrderById } from '@/utils/order'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import SalesPage from './SalesPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Order', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  const order = await getOrderById(api, params.id)

  return <SalesPage organization={organization} order={order} />
}
