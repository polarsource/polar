import { NavigateToOrganization } from '@/components/Organization/OrganizationNavigation'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getUserOrganizations } from '@/utils/user'
import { redirect } from 'next/navigation'

export default async function Page() {
  const api = getServerSideAPI()
  const userOrganizations = await getUserOrganizations(api)

  if (userOrganizations.length === 0) {
    redirect('/dashboard/create')
  }

  return <NavigateToOrganization userOrganizations={userOrganizations} />
}
