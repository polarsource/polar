import SubscriptionSuccess from '@/components/Subscriptions/SubscriptionSuccess'
import { useAPI } from '@/hooks/api'
import { ResponseError } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'

export default async function Page({
  searchParams,
  params,
}: {
  params: { organization: string }
  searchParams: { session_id: string }
}) {
  const api = useAPI()
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
