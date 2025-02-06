import { getServerSideAPI } from '@/utils/client/serverside'
import { getLastVisitedOrg } from '@/utils/cookies'
import { getUserOrganizations } from '@/utils/user'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page() {
  const api = getServerSideAPI()
  const userOrganizations = await getUserOrganizations(api)

  if (userOrganizations.length === 0) {
    redirect('/dashboard/create')
  }

  const org = userOrganizations.find(
    (org) => org.slug === getLastVisitedOrg(cookies()),
  )

  const targetOrg = org?.slug ?? userOrganizations[0].slug

  redirect(`/dashboard/${targetOrg}`)
}
