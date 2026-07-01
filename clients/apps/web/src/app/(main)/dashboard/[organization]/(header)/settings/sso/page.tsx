import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SSOPage from './SSOPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Single Sign-On',
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  if (!organization.feature_settings?.sso_enabled) {
    notFound()
  }

  return <SSOPage organization={organization} />
}
