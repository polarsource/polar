import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Checkout Links',
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

  // Fetch the newest checkout link
  const productId = searchParams.productId
  const { data } = await api.GET('/v1/checkout-links/', {
    params: {
      query: {
        organization_id: organization.id,
        ...(productId && { product_id: productId }),
        limit: 1,
        sorting: ['-created_at'],
      },
    },
  })

  // If there's a newest checkout link, redirect to it (preserving query params)
  if (data?.items && data.items.length > 0) {
    const queryString = new URLSearchParams(
      searchParams as Record<string, string>,
    ).toString()
    const redirectUrl = `/dashboard/${organization.slug}/products/checkout-links/${data.items[0].id}${queryString ? `?${queryString}` : ''}`
    redirect(redirectUrl)
  }

  // Otherwise show empty state
  return (
    <div className="flex h-full flex-col items-center justify-center pt-32">
      <div className="flex flex-col items-center justify-center gap-y-8">
        <LinkOutlined fontSize="large" />
        <div className="flex flex-col items-center justify-center gap-y-2">
          <h3 className="text-xl">No Checkout Links</h3>
          <p className="dark:text-polar-500 text-gray-500">
            Create a new checkout link to share with your customers
          </p>
        </div>
        <Link
          href={`/dashboard/${organization.slug}/products/checkout-links?create_checkout_link=true`}
        >
          <Button>Create Checkout Link</Button>
        </Link>
      </div>
    </div>
  )
}
