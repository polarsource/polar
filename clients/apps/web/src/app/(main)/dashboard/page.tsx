import { getLastVisitedOrg } from '@/utils/cookies'
import { getUserOrganizations } from '@/utils/user'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const userOrganizations = await getUserOrganizations()
  const params = await searchParams
  const query = new URLSearchParams(params).toString()
  const qs = query ? `?${query}` : ''

  if (userOrganizations.length === 0) {
    redirect(`/onboarding/start${qs}`)
  }

  const lastVisitedOrg = getLastVisitedOrg(await cookies(), userOrganizations)
  const organization = lastVisitedOrg ? lastVisitedOrg : userOrganizations[0]
  redirect(`/dashboard/${organization.slug}${qs}`)
}
