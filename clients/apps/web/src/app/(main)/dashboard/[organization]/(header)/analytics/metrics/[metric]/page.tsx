import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { isValidMetricType, MetricType } from '../components/metrics-config'
import {
  MetricsSearchParams,
  validateMetricsSearchParams,
} from '../utils/validateSearchParams'
import ClientPage from './ClientPage'

export default async function Page(props: {
  params: Promise<{ organization: string; metric: string }>
  searchParams: Promise<MetricsSearchParams>
}) {
  const { organization: organizationSlug, metric } = await props.params
  const searchParams = await props.searchParams

  if (!isValidMetricType(metric)) {
    notFound()
  }

  const params = await validateMetricsSearchParams(
    organizationSlug,
    searchParams,
    `/dashboard/${organizationSlug}/analytics/metrics/${metric}`,
  )

  // Fetch products to determine hasRecurringProducts/hasOneTimeProducts
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    organizationSlug,
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

  const relevantProducts = params.productId
    ? products.items.filter((p) => params.productId!.includes(p.id))
    : products.items

  const hasRecurringProducts = relevantProducts.some((p) => p.is_recurring)
  const hasOneTimeProducts = relevantProducts.some((p) => !p.is_recurring)

  return (
    <ClientPage
      {...params}
      metric={metric as MetricType}
      hasRecurringProducts={hasRecurringProducts}
      hasOneTimeProducts={hasOneTimeProducts}
    />
  )
}
