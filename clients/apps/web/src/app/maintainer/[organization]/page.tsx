import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { redirect } from 'next/navigation'

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return redirect(`/maintainer/${organization.slug}/home`)
}
