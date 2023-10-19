import SubscriptionSuccess from '@/components/Subscriptions/SubscriptionSuccess'
import { getServerSideAPI } from '@/utils/api'
import { ResponseError } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'

export default async function Page({
  searchParams,
  params,
}: {
  params: { organization: string }
  searchParams: { session_id: string }
}) {
  const api = getServerSideAPI()
  try {
    const subscribeSession = await api.subscriptions.getSubscribeSession({
      id: searchParams.session_id,
    })
    return <SubscriptionSuccess subscribeSession={subscribeSession} />
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    }
  }
}
