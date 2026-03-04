import { getServerSideAPI } from '@/utils/client/serverside'
import { getLastVisitedOrg } from '@/utils/cookies'
import { getUserOrganizations } from '@/utils/user'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const api = await getServerSideAPI()
  const userOrganizations = await getUserOrganizations(api, true)
  const params = await searchParams
  const query = new URLSearchParams(params).toString()
  const qs = query ? `?${query}` : ''

  if (userOrganizations.length === 0) {
    redirect(`/dashboard/create${qs}`)
  }

  const lastVisitedOrg = getLastVisitedOrg(await cookies(), userOrganizations)
  const organization = lastVisitedOrg ? lastVisitedOrg : userOrganizations[0]
  redirect(`/dashboard/${organization.slug}${qs}`)
}
