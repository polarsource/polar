import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Benefits', // " | Polar is added by the template"
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

  // Fetch the newest benefit
  const { data } = await api.GET('/v1/benefits/', {
    params: {
      query: {
        organization_id: organization.id,
        limit: 1,
        sorting: ['-created_at'],
      },
    },
  })

  // If there's a newest benefit, redirect to it (preserving query params)
  if (data?.items && data.items.length > 0) {
    const queryString = new URLSearchParams(
      searchParams as Record<string, string>,
    ).toString()
    const redirectUrl = `/dashboard/${organization.slug}/products/benefits/${data.items[0].id}${queryString ? `?${queryString}` : ''}`
    redirect(redirectUrl)
  }

  // Otherwise show empty state
  return (
    <div className="mt-96 flex w-full flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-normal">No Benefits</h1>
      <p className="dark:text-polar-500 text-gray-500">
        Create a benefit to get started
      </p>
      <Link
        href={`/dashboard/${organization.slug}/products/benefits?create_benefit=true`}
      >
        <Button>Create Benefit</Button>
      </Link>
    </div>
  )
}
