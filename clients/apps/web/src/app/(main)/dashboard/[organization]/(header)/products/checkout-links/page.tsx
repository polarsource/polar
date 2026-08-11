import { CheckoutLinksTable } from '@/components/CheckoutLinks/CheckoutLinksTable'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Checkout Links',
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

  return (
    <DashboardBody wide>
      <CheckoutLinksTable organization={organization} />
    </DashboardBody>
  )
}
