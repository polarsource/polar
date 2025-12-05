import { getServerSideAPI } from '@/utils/client/serverside'
import {
  getOrganizationBySlug,
  getOrganizationBySlugOrNotFound,
} from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CustomersPage from './CustomersPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string; customerId: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlug(api, params.organization)

  if (!organization) {
    return {
      title: 'Customer Not Found',
    }
  }

  const { data: customer } = await api.GET('/v1/customers/{id}', {
    params: {
      path: { id: params.customerId },
    },
  })

  if (!customer || customer.organization_id !== organization.id) {
    return {
      title: 'Customer Not Found',
    }
  }

  const title = customer.name || customer.email

  return {
    title,
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; customerId: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const { data: customer } = await api.GET('/v1/customers/{id}', {
    params: {
      path: { id: params.customerId },
    },
  })

  if (!customer || customer.organization_id !== organization.id) {
    notFound()
  }

  return <CustomersPage organization={organization} customer={customer} />
}
