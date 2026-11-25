import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import SubscriptionsPage from './SubscriptionsPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Subscriptions', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
    params.organization,
  )

  return <SubscriptionsPage organization={organization} />
}
