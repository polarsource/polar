import { getServerSideAPI } from '@/utils/api/serverside'
import { CustomerOrder, ResponseError } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

export default async function Page({ params }: { params: { id: string } }) {
  const api = getServerSideAPI()

  let order: CustomerOrder

  try {
    order = await api.customerPortalOrders.get({ id: params.id })
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  return <ClientPage order={order} />
}
