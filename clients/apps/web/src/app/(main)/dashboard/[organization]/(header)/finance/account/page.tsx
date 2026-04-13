import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import AccountPage from './AccountPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Finance - Payout Account`, // " | Polar is added by the template"
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
    false, // Don't use cache to make sure we get the latest payout account info after onboarding changes
  )

  return <AccountPage organization={organization} />
}
