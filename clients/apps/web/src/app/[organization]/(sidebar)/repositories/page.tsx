import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlug } from '@/utils/organization'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ClientPage } from './ClientPage'

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
  const organization = await getOrganizationBySlug(
    api,
    params.organization,
    cacheConfig,
  )

  if (!organization) {
    notFound()
  }

  return {
    title: `${organization.slug}`, // " | Polar is added by the template"
    openGraph: {
      title: `${
        organization.pretty_name || organization.slug
      } all repositories`,
      description: `${
        organization.pretty_name || organization.slug
      } all repositories`,
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
          alt: `${
            organization.pretty_name || organization.slug
          } all repositories`,
        },
      ],
      card: 'summary_large_image',
      title: `${
        organization.pretty_name || organization.slug
      } all repositories`,
      description: `${
        organization.pretty_name || organization.slug
      } all repositories`,
    },
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
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

  const repositories = await api.repositories.list(
    {
      organizationId: organization.id,
    },
    cacheConfig,
  )

  return (
    <ClientPage
      organization={organization}
      repositories={repositories.items ?? []}
    />
  )
}
