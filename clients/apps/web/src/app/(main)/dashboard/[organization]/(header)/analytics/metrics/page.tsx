import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { unwrap } from '@polar-sh/client'
import { RedirectType, redirect } from 'next/navigation'

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<Record<string, string | string[]>>
}) {
  const params = await props.params
  const searchParams = await props.searchParams
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

  // Determine first available tab
  let firstTab = 'orders' // Default fallback (always visible)
  if (hasRecurringProducts) {
    firstTab = 'subscriptions'
  } else if (hasOneTimeProducts) {
    firstTab = 'one-time'
  }

  // Preserve search params
  const urlSearchParams = new URLSearchParams()
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => urlSearchParams.append(key, v))
    } else {
      urlSearchParams.append(key, value)
    }
  })

  const queryString = urlSearchParams.toString()
  redirect(
    `/dashboard/${organization.slug}/analytics/metrics/${firstTab}${queryString ? `?${queryString}` : ''}`,
    RedirectType.replace,
  )
}
