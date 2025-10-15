import { getServerSideAPI } from '@/utils/client/serverside'
import { getLastVisitedOrg } from '@/utils/cookies'
import { getUserOrganizations } from '@/utils/user'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * An authenticated user is automatically redirected to this page when accessing `/` instead of seeing the landing page.
 * This is done in [`next.config.mjs`](../../../next.config.mjs).
 *
 * This page aims at determining where to redirect an authenticated user.
 *
 * - If the user has no organizations, redirect to the organization creation page.
 * - If the user has organizations and a last visited organization, redirect them to that organization's dashboard.
 * - Otherwise, redirect them to the first organization's dashboard.
 */

export default async function Page() {
  const api = await getServerSideAPI()
  const userOrganizations = await getUserOrganizations(api, true)

  if (userOrganizations.length === 0) {
    redirect('/dashboard/create')
  }

  const lastVisitedOrg = getLastVisitedOrg(await cookies(), userOrganizations)
  const organization = lastVisitedOrg ? lastVisitedOrg : userOrganizations[0]
  redirect(`/dashboard/${organization.slug}`)
}
