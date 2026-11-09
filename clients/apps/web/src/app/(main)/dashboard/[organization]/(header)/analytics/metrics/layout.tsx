import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { DashboardViewActions } from '@/components/Metrics/dashboards/DashboardViewHeader'
import { MetricsHeader } from '@/components/Metrics/dashboards/MetricsHeader'
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

  const limits = await unwrap(api.GET('/v1/metrics/limits'))

  return (
    <DashboardBody
      wide
      title="Metrics"
      titleActions={
        <DashboardViewActions
          organization={organization}
          earliestDateISOString={limits.min_date}
        />
      }
      header={
        <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-x-6">
          <MetricsHeader
            organization={organization}
            earliestDateISOString={limits.min_date}
          />
          <DashboardViewActions
            organization={organization}
            earliestDateISOString={limits.min_date}
            className="hidden md:flex"
          />
        </div>
      }
    >
      {props.children}
    </DashboardBody>
  )
}
