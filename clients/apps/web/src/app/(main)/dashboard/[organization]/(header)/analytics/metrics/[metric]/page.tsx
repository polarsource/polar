import { METRIC_GROUPS, metricGroupSlug } from '@/utils/metrics'
import { notFound, redirect, RedirectType } from 'next/navigation'

const METRIC_GROUP_SLUGS = new Set(
  METRIC_GROUPS.map((g) => metricGroupSlug(g.category)),
)

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Page(props: {
  params: Promise<{ organization: string; metric: string }>
  searchParams: Promise<Record<string, string | string[]>>
}) {
  const { organization, metric } = await props.params
  const searchParams = await props.searchParams

  if (!METRIC_GROUP_SLUGS.has(metric) && !UUID_REGEX.test(metric)) {
    notFound()
  }

  const urlSearchParams = new URLSearchParams()
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => urlSearchParams.append(key, v))
    } else {
      urlSearchParams.append(key, value)
    }
  })

  urlSearchParams.set('section', metric)
  redirect(
    `/dashboard/${organization}/analytics/metrics?${urlSearchParams}`,
    RedirectType.replace,
  )
}
