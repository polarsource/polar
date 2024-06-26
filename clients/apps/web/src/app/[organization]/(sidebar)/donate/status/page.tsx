import { getServerSideAPI } from '@/utils/api/serverside'
import { Organization, Platforms, ResponseError } from '@polar-sh/sdk'
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
  let organization: Organization | undefined
  const api = getServerSideAPI()

  try {
    organization = await api.organizations.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      cacheConfig,
    )
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  if (!organization) {
    notFound()
  }

  return {
    title: `Donate to ${organization.pretty_name || organization.name}`, // " | Polar is added by the template"
    description: `Donate to ${organization.pretty_name || organization.name}`,
    openGraph: {
      title: `Donate to ${organization.pretty_name || organization.name}`,
      description: `Donate to ${organization.pretty_name || organization.name}`,
      siteName: 'Polar',

      images: [
        {
          url: `https://polar.sh/og?org=${organization.name}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${organization.name}`,
          width: 1200,
          height: 630,
          alt: `Donate to ${organization.pretty_name || organization.name}`,
        },
      ],
      card: 'summary_large_image',
      title: `Donate to ${organization.pretty_name || organization.name}`,
      description: `Donate to ${organization.pretty_name || organization.name}`,
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
  let organization: Organization | undefined
  const api = getServerSideAPI()

  try {
    organization = await api.organizations.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      cacheConfig,
    )
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  if (!organization) {
    notFound()
  }

  const email =
    typeof searchParams?.email === 'string' ? searchParams.email : undefined

  return <ClientPage organization={organization} email={email} />
}
