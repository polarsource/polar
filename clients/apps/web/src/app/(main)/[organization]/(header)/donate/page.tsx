import { getServerSideAPI } from '@/utils/api/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import { Issue } from '@polar-sh/sdk'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
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
    title: `Donate to ${organization.name}`, // " | Polar is added by the template"
    description: `Donate to ${organization.name}`,
    openGraph: {
      title: `Donate to ${organization.name}`,
      description: `Donate to ${organization.name}`,
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
          alt: `Donate to ${organization.name}`,
        },
      ],
      card: 'summary_large_image',
      title: `Donate to ${organization.name}`,
      description: `Donate to ${organization.name}`,
    },
  }
}

export default async function Page({
  params,
  searchParams: { amount, issue_id },
}: {
  params: { organization: string }
  searchParams: { amount?: string; issue_id?: string }
}) {
  const api = getServerSideAPI()
  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )
  let issue: Issue | undefined

  try {
    const [loadIssue] = await Promise.all([
      // Optional Issue Loading
      issue_id
        ? api.issues.get({ id: issue_id }, cacheConfig)
        : Promise.resolve(undefined),
    ])

    issue = loadIssue
  } catch (e) {
    notFound()
  }

  // If issue and issue does not match org
  if (
    issue &&
    issue.repository.organization.organization_id !== organization.id
  ) {
    notFound()
  }

  return (
    <ClientPage
      organization={organization}
      defaultAmount={parseInt(amount ?? '2000')}
      issue={issue}
    />
  )
}
