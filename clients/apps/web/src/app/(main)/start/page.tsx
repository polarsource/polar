import { NavigateToOrganization } from '@/components/Organization/OrganizationNavigation'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getUserOrganizations } from '@/utils/user'
import { redirect } from 'next/navigation'

/**
 * An authenticated user is automatically redirected to this page when accessing `/` instead of seeing the landing page.
 * This is done in [`next.config.mjs`](../../../next.config.mjs).
 *
 * This page aims at determining where to redirect an authenticated user.
 *
 * - If the user has no organization, redirect them to their purchases page.
 * - If the user has at least one organization and the last visited organization is stored in local storage,
 *   redirect them to the last visited organization's dashboard.
 * - Otherwise, redirect them to the first organization's dashboard.
 */

export default async function Page() {
  const api = getServerSideAPI()
  const userOrganizations = await getUserOrganizations(api)

  if (userOrganizations.length === 0) {
    redirect('/purchases')
  }

  return <NavigateToOrganization userOrganizations={userOrganizations} />
}
