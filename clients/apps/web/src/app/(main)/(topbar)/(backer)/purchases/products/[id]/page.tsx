import { getServerSideAPI } from '@/utils/api/serverside'
import { ResponseError, UserOrder } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

export default async function Page({ params }: { params: { id: string } }) {
  const api = getServerSideAPI()

  let order: UserOrder

  try {
    order = await api.usersOrders.get({ id: params.id })
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  return <ClientPage order={order} />
}
