import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import FeaturePage from './FeaturePage'

export async function generateMetadata(props: {
  params: Promise<{ name: string }>
}): Promise<Metadata> {
  const { name } = await props.params
  return { title: decodeURIComponent(name) }
}

export default async function Page(props: {
  params: Promise<{ organization: string; name: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return (
    <FeaturePage
      organization={organization}
      name={decodeURIComponent(params.name)}
    />
  )
}
