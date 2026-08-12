import { getServerSideAPI } from '@/utils/client/serverside'
import {
  getOrganizationBySlug,
  getOrganizationBySlugOrNotFound,
} from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

export interface CustomerPageParams {
  organization: string
  customerId: string
}

export const getOrganizationAndCustomerOrNotFound = async (
  params: CustomerPageParams,
) => {
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

  return { organization, customer }
}

export const generateCustomerMetadata = async (
  params: CustomerPageParams,
  section?: string,
): Promise<Metadata> => {
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

  const title = customer.name || customer.email || '—'

  return {
    title: section ? `${title} · ${section}` : title,
  }
}
