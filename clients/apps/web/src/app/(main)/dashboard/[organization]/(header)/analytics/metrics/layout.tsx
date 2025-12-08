import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { unwrap } from '@polar-sh/client'
import { MetricsHeader } from './components/MetricsHeader'
import { MetricsSubNav } from './components/MetricsSubNav'

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

  const [products, limits] = await Promise.all([
    unwrap(
      api.GET('/v1/products/', {
        params: {
          query: {
            organization_id: organization.id,
            limit: 100,
            is_archived: false,
          },
        },
      }),
    ),
    unwrap(api.GET('/v1/metrics/limits')),
  ])

  const hasRecurringProducts = products.items.some((p) => p.is_recurring)
  const hasOneTimeProducts = products.items.some((p) => !p.is_recurring)

  return (
    <DashboardBody
      wide
      header={
        <MetricsHeader
          organization={organization}
          earliestDateISOString={limits.min_date}
        />
      }
    >
      <div className="mb-7">
        <MetricsSubNav
          organization={organization}
          hasRecurringProducts={hasRecurringProducts}
          hasOneTimeProducts={hasOneTimeProducts}
        />
      </div>
      {props.children}
    </DashboardBody>
  )
}
