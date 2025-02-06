import { getServerSideAPI } from '@/utils/api/serverside'
import { getServerSideAPI as getNewServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { getSubscriptionById } from '@/utils/subscription'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Subscription', // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string; id: string }
}) {
  const newAPI = getNewServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    newAPI,
    params.organization,
  )
  const api = getServerSideAPI()
  const subscription = await getSubscriptionById(api, params.id)

  return <ClientPage organization={organization} subscription={subscription} />
}
