import { getServerSideAPI } from '@/utils/api/serverside'
import { redirect } from 'next/navigation'

export default async function Page() {
  const api = getServerSideAPI()
  const userOrganizations = await api.organizations.list(
    { isMember: true, sorting: ['created_at'] },
    { cache: 'no-store' },
  )

  if (!userOrganizations.items || userOrganizations.items.length === 0) {
    redirect('/maintainer/create')
  }

  redirect(`/maintainer/${userOrganizations.items[0].slug}`)
}
