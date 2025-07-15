import { getServerSideAPI } from '@/utils/client/serverside'
import { DataTableSearchParams } from '@/utils/datatable'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { ClientPage } from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Checkout Links', // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
  searchParams: DataTableSearchParams & {
    product_id?: string[] | string
  }
}) {
  const api = getServerSideAPI()
  await getOrganizationBySlugOrNotFound(api, params.organization)

  return <ClientPage />
}
