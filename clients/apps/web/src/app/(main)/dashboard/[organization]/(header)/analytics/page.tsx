import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
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
    `/dashboard/${organization.slug}/analytics/metrics${queryString ? `?${queryString}` : ''}`,
    RedirectType.replace,
  )
}
