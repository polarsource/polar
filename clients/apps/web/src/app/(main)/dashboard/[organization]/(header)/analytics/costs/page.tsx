import { redirect } from 'next/navigation'
import { toRedirectValue } from './redirectQuery'

// Costs now lives next to Events, as a mode of the same explorer.
export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { organization } = await props.params
  const searchParams = await props.searchParams
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    const redirectValue = toRedirectValue(value)
    if (redirectValue) query.set(key, redirectValue)
  }
  const search = query.size > 0 ? `?${query}` : ''
  redirect(`/dashboard/${organization}/analytics/events/costs${search}`)
}
