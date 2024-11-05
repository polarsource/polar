import {
  FilterSearchParams,
  buildFundingFilters,
  urlSearchFromObj,
} from '@/components/Organization/filters'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import type { Metadata } from 'next'
import ClientPage from './ClientPage'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export async function generateMetadata({
  params,
}: {
  params: { organization: string }
}): Promise<Metadata> {
  const api = getServerSideAPI()
  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  return {
    title: `${organization.name}`, // " | Polar is added by the template"
    openGraph: {
      title: `${organization.name} seeks funding for issues`,
      description: `${organization.name} seeks funding for issues on Polar`,
      siteName: 'Polar',

      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
          alt: `${organization.name} seeks funding for issues`,
        },
      ],
      card: 'summary_large_image',
      title: `${organization.name} seeks funding for issues`,
      description: `${organization.name} seeks funding for issues on Polar`,
    },
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: FilterSearchParams
}) {
  const api = getServerSideAPI()
  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  const filters = buildFundingFilters(urlSearchFromObj(searchParams))

  const issues = await api.funding.search(
    {
      organizationId: organization.id,
      query: filters.q,
      sorting: filters.sort,
      badged: filters.badged,
      limit: 20,
      closed: filters.closed,
      page: searchParams.page ? parseInt(searchParams.page) : 1,
    },
    cacheConfig,
  )

  return <ClientPage organization={organization} issues={issues} />
}
