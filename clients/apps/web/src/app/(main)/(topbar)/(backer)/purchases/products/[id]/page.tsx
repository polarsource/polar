import { getServerSideAPI } from '@/utils/client/serverside'
import { unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

export default async function Page({ params }: { params: { id: string } }) {
  const api = getServerSideAPI()
  const order = await unwrap(
    api.GET('/v1/customer-portal/orders/{id}', {
      params: { path: { id: params.id } },
      cache: 'no-store',
    }),
    { 404: notFound },
  )

  return <ClientPage order={order} />
}
