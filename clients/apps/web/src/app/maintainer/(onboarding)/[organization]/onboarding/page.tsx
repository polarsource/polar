import { shouldBeOnboarded } from '@/hooks/onboarding'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlug } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import ClientPage from './ClientPage'

export async function generateMetadata({
  params,
}: {
  params: { organization: string }
}): Promise<Metadata> {
  return {
    title: `${params.organization}`, // " | Polar is added by the template"
  }
}

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

  if (!shouldBeOnboarded(organization)) {
    return redirect(`/maintainer/${organization.name}`)
  }

  return <ClientPage organization={organization} />
}
