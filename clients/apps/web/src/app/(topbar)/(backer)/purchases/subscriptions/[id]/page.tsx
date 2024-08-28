import { getServerSideAPI } from '@/utils/api/serverside'
import { ResponseError, UserSubscription } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

export default async function Page({ params }: { params: { id: string } }) {
  const api = getServerSideAPI()

  let subscription: UserSubscription | undefined

  try {
    subscription = await api.usersSubscriptions.get({ id: params.id })
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  return <ClientPage subscription={subscription} />
}
