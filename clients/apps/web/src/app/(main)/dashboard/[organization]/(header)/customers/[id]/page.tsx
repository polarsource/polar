import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const api = getServerSideAPI()
  const customer = await api.customers.get({ id: params.id })

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
  const customer = await api.customers.get(
    { id: params.id },
    {
      next: {
        tags: [`customer:${params.id}`],
        revalidate: 600,
      },
    },
  )

  if (!customer) {
    return notFound()
  }

  return <ClientPage organization={organization} customer={customer} />
}
