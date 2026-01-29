import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import PerksPage from './PerksPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Startup Stack - Perks',
    description: 'Exclusive perks and discounts for Spaire startups',
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

  return <PerksPage organization={organization} />
}
