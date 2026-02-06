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

  // Otherwise show empty state as onboarding
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 py-24">
      <div className="flex max-w-md flex-col items-center gap-y-4 text-center">
        <h1 className="text-xl font-medium">Add value with benefits</h1>
        <p className="dark:text-polar-500 text-gray-500">
          Benefits are extras you attach to products — file downloads,
          Discord access, license keys, custom integrations, and more.
          Customers receive them automatically after purchase.
        </p>
      </div>
      <Link
        href={`/dashboard/${organization.slug}/products/benefits?create_benefit=true`}
      >
        <Button>Create Benefit</Button>
      </Link>
    </div>
  )
}
