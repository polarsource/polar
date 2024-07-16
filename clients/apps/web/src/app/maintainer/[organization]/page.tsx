import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlug } from '@/utils/organization'
import { notFound, redirect } from 'next/navigation'

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlug(api, params.organization)

  if (!organization) {
    notFound()
  }

  return redirect(`/maintainer/${organization.name}/overview`)
}
