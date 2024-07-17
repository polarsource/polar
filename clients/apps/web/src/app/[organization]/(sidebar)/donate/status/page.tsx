import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlug } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

const cacheConfig = {
  cache: 'no-store',
} as const

export async function generateMetadata({
  params,
}: {
  params: { organization: string }
}): Promise<Metadata> {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlug(
    api,
    params.organization,
    cacheConfig,
  )

  if (!organization) {
    notFound()
  }

  return {
    title: `Donate to ${organization.pretty_name || organization.slug}`, // " | Polar is added by the template"
    description: `Donate to ${organization.pretty_name || organization.slug}`,
    openGraph: {
      title: `Donate to ${organization.pretty_name || organization.slug}`,
      description: `Donate to ${organization.pretty_name || organization.slug}`,
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
          alt: `Donate to ${organization.pretty_name || organization.slug}`,
        },
      ],
      card: 'summary_large_image',
      title: `Donate to ${organization.pretty_name || organization.slug}`,
      description: `Donate to ${organization.pretty_name || organization.slug}`,
    },
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlug(
    api,
    params.organization,
    cacheConfig,
  )

  if (!organization) {
    notFound()
  }

  const email =
    typeof searchParams?.email === 'string' ? searchParams.email : undefined

  return <ClientPage organization={organization} email={email} />
}
