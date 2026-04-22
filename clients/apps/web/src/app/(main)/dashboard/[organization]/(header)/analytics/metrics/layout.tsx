import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { DashboardsListSidebar } from '@/components/Metrics/dashboards/DashboardsListSidebar'
import { DashboardViewHeader } from '@/components/Metrics/dashboards/DashboardViewHeader'
import { getServerSideAPI } from '@/utils/client/serverside'
import { METRIC_GROUPS } from '@/utils/metrics'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { unwrap } from '@polar-sh/client'

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
            is_archived: null,
          },
        },
      }),
    ),
    unwrap(api.GET('/v1/metrics/limits')),
  ])

  const hasRecurringProducts = products.items.some((p) => p.is_recurring)

  const defaultDashboards = METRIC_GROUPS.map((g) => ({
    slug: g.category.toLowerCase().replace(/\s+/g, '-'),
    title: g.category,
  })).filter(({ slug }) => {
    if (slug === 'subscriptions' || slug === 'cancellations') {
      return hasRecurringProducts
    }
    return true
  })

  return (
    <DashboardBody
      wide
      title={null}
      header={
        <DashboardViewHeader
          organization={organization}
          earliestDateISOString={limits.min_date}
        />
      }
      contextView={
        <DashboardsListSidebar
          organization={organization}
          defaultDashboards={defaultDashboards}
        />
      }
      contextViewPlacement="left"
      contextViewClassName="md:max-w-[300px] xl:max-w-[320px]"
    >
      {props.children}
    </DashboardBody>
  )
}
