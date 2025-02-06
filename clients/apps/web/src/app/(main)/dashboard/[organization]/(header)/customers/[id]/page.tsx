import { getServerSideAPI } from '@/utils/client/serverside'
import { getCustomerById } from '@/utils/customer'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const api = getServerSideAPI()
  const customer = await getCustomerById(api, params.id)

  return {
    title: customer.name,
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string; id: string }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  const customer = await getCustomerById(api, params.id)

  return <ClientPage organization={organization} customer={customer} />
}
