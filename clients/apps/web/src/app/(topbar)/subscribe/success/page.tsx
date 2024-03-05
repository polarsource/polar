import SubscriptionSuccess from '@/components/Subscriptions/SubscriptionSuccess'
import { PublicPageOrganizationContextProvider } from '@/providers/organization'
import { getServerSideAPI } from '@/utils/api'
import { Organization, ResponseError, SubscribeSession } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'

export default async function Page({
  searchParams,
}: {
  searchParams: { session_id: string }
}) {
  const api = getServerSideAPI()

  let subscribeSession: SubscribeSession | undefined

  try {
    subscribeSession = await api.subscriptions.getSubscribeSession({
      id: searchParams.session_id,
    })
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  if (!subscribeSession) {
    notFound()
  }

  if (!subscribeSession.subscription_tier.organization_id) {
    notFound()
  }

  let organization: Organization | undefined
  try {
    organization = await api.organizations.get({
      id: subscribeSession.subscription_tier.organization_id,
    })
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  if (!organization) {
    notFound()
  }

  return (
    <PublicPageOrganizationContextProvider organization={organization}>
      <SubscriptionSuccess subscribeSession={subscribeSession} />
    </PublicPageOrganizationContextProvider>
  )
}
