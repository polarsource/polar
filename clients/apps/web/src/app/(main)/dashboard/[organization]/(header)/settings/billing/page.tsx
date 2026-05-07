import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BillingPage from './BillingPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Billing Settings', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  if (!organization.feature_settings?.billing_enabled) {
    notFound()
  }

  return <BillingPage organization={organization} />
}
