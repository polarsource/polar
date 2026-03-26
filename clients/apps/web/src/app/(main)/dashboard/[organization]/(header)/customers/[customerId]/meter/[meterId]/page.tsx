import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CustomerMeterPage from './CustomerMeterPage'

type Params = Promise<{
  organization: string
  customerId: string
  meterId: string
}>

export async function generateMetadata(props: {
  params: Params
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const { data: meter } = await api.GET('/v1/meters/{id}', {
    params: { path: { id: params.meterId } },
  })

  if (!meter || meter.organization_id !== organization.id) {
    return { title: 'Meter Not Found' }
  }

  return { title: meter.name }
}

export default async function Page(props: { params: Params }) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const [{ data: customer }, { data: meter }] = await Promise.all([
    api.GET('/v1/customers/{id}', {
      params: { path: { id: params.customerId } },
    }),
    api.GET('/v1/meters/{id}', {
      params: { path: { id: params.meterId } },
    }),
  ])

  if (!customer || customer.organization_id !== organization.id) notFound()
  if (!meter || meter.organization_id !== organization.id) notFound()

  return (
    <CustomerMeterPage
      organization={organization}
      customer={customer}
      meter={meter}
    />
  )
}
