import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { DashboardsListSidebar } from '@/components/metrics/dashboards/DashboardsListSidebar'
import { DashboardViewHeader } from '@/components/metrics/dashboards/DashboardViewHeader'
import { MetricType } from '@/components/metrics/dashboards/metrics-config'
import { getServerSideAPI } from '@/utils/client/serverside'
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
            is_archived: false,
          },
        },
      }),
    ),
    unwrap(api.GET('/v1/metrics/limits')),
  ])

  const hasRecurringProducts = products.items.some((p) => p.is_recurring)
  const hasOneTimeProducts = products.items.some((p) => !p.is_recurring)
  const revopsEnabled = organization.feature_settings?.revops_enabled ?? false

  const allDefaultDashboards: { slug: MetricType; title: string }[] = [
    { slug: 'subscriptions' as const, title: 'Subscriptions' },
    { slug: 'cancellations' as const, title: 'Cancellations' },
    { slug: 'net-revenue' as const, title: 'Net Revenue' },
    { slug: 'orders' as const, title: 'Orders' },
    { slug: 'checkouts' as const, title: 'Checkouts' },
    { slug: 'one-time' as const, title: 'One-time Purchases' },
    { slug: 'costs' as const, title: 'Costs' },
  ]

  const defaultDashboards = allDefaultDashboards.filter(({ slug }) => {
    if (slug === 'subscriptions' || slug === 'cancellations') {
      return hasRecurringProducts
    }
    if (slug === 'one-time') return hasOneTimeProducts
    if (slug === 'costs') return revopsEnabled
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
