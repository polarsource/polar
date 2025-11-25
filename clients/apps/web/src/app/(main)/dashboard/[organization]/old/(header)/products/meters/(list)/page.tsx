import { MeterIngestionGuide } from '@/components/Meter/MeterIngestionGuide'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Meters', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await props.params
  const searchParams = await props.searchParams
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  // Fetch the newest meter
  const { data } = await api.GET('/v1/meters/', {
    params: {
      query: {
        organization_id: organization.id,
        limit: 1,
        sorting: ['-created_at'],
        is_archived: false,
      },
    },
  })

  // If there's a newest meter, redirect to it (preserving query params)
  if (data?.items && data.items.length > 0) {
    const queryString = new URLSearchParams(
      searchParams as Record<string, string>,
    ).toString()
    const redirectUrl = `/dashboard/${organization.slug}/products/meters/${data.items[0].id}${queryString ? `?${queryString}` : ''}`
    redirect(redirectUrl)
  }

  // Otherwise show empty state with create button
  return <MeterIngestionGuide />
}
