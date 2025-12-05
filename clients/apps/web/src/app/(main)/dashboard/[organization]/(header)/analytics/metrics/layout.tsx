import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { unwrap } from '@polar-sh/client'
import { MetricsLayoutClient } from './components/MetricsLayoutClient'

export default async function Layout(props: {
  params: Promise<{ organization: string }>
  children: React.ReactNode
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const products = await unwrap(
    api.GET('/v1/products/', {
      params: {
        query: {
          organization_id: organization.id,
          limit: 100,
          is_archived: false,
        },
      },
    }),
  )

  const hasRecurringProducts = products.items.some((p) => p.is_recurring)
  const hasOneTimeProducts = products.items.some((p) => !p.is_recurring)

  return (
    <MetricsLayoutClient
      organization={organization}
      hasRecurringProducts={hasRecurringProducts}
      hasOneTimeProducts={hasOneTimeProducts}
    >
      {props.children}
    </MetricsLayoutClient>
  )
}
