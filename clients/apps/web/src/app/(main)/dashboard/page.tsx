import { getServerSideAPI } from '@/utils/client/serverside'
import { getLastVisitedOrg } from '@/utils/cookies'
import { getUserOrganizations } from '@/utils/user'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page() {
  const api = await getServerSideAPI()
  const userOrganizations = await getUserOrganizations(api, true)

  if (userOrganizations.length === 0) {
    redirect('/dashboard/create')
  }

  const org = userOrganizations.find(
    async (org) => org.slug === getLastVisitedOrg(await cookies()),
  )

  const targetOrg = org?.slug ?? userOrganizations[0].slug

  redirect(`/dashboard/${targetOrg}`)
}
