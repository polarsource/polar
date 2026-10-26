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
  const [params, api] = await Promise.all([props.params, getServerSideAPI()])
  const [organization, order] = await Promise.all([
    getOrganizationBySlugOrNotFound(api, params.organization),
    getOrderById(api, params.id),
  ])

  return <SalesPage organization={organization} order={order} />
}
