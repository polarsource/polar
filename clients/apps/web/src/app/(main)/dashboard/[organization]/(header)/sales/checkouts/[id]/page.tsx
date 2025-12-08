import { getCheckoutById } from '@/utils/checkout'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import CheckoutsPage from './CheckoutsPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Checkout', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  const checkout = await getCheckoutById(api, params.id)

  return <CheckoutsPage organization={organization} checkout={checkout} />
}
