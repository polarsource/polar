import {
  MetricsSearchParams,
  validateMetricsSearchParams,
} from '../utils/validateSearchParams'
import ClientPage from './ClientPage'

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<MetricsSearchParams>
}) {
  const { organization: organizationSlug } = await props.params
  const searchParams = await props.searchParams

  const params = await validateMetricsSearchParams(
    organizationSlug,
    searchParams,
    `/dashboard/${organizationSlug}/analytics/metrics/costs`,
  )

  return <ClientPage {...params} />
}
