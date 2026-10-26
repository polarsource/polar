import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { getSubscriptionById } from '@/utils/subscription'
import { Metadata } from 'next'
import SubscriptionsPage from './SubscriptionsPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Subscription', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
}) {
  const [params, api] = await Promise.all([props.params, getServerSideAPI()])
  const [organization, subscription] = await Promise.all([
    getOrganizationBySlugOrNotFound(api, params.organization),
    getSubscriptionById(api, params.id),
  ])

  return (
    <SubscriptionsPage
      organization={organization}
      subscription={subscription}
    />
  )
}
