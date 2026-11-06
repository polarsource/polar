import { redirect } from 'next/navigation'
import { toRedirectValue } from '../redirectQuery'

// The span page is now the event type panel on the costs explorer.
export default async function Page(props: {
  params: Promise<{ organization: string; spanId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { organization, spanId } = await props.params
  const searchParams = await props.searchParams
  const query = new URLSearchParams({ type: spanId })
  for (const key of ['startDate', 'endDate', 'customerIds']) {
    const value = toRedirectValue(searchParams[key])
    if (value) query.set(key, value)
  }
  redirect(`/dashboard/${organization}/analytics/events/costs?${query}`)
}
