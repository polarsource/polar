import { getServerSideAPI } from '@/utils/api/serverside'
import {
  Issue,
  ListResourceOrganization,
  ListResourceProduct,
  Organization,
  Platforms,
} from '@polar-sh/sdk'
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

  let organization: Organization | undefined

  try {
    const [loadOrganization] = await Promise.all([
      api.organizations.lookup(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
        },
        {
          ...cacheConfig,
        },
      ),
    ])

    organization = loadOrganization
  } catch (e) {
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
  searchParams: { amount, issue_id },
}: {
  params: { organization: string }
  searchParams: { amount?: string; issue_id?: string }
}) {
  const api = getServerSideAPI()

  let organization: Organization | undefined
  let listAdminOrganizations: ListResourceOrganization | undefined
  let products: ListResourceProduct | undefined
  let issue: Issue | undefined

  try {
    organization = await api.organizations.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      {
        cache: 'no-store',
      },
    )
    const [loadListAdminOrganizations, loadSubscriptionTiers, loadIssue] =
      await Promise.all([
        api.organizations
          .list(
            {
              isAdminOnly: true,
            },
            cacheConfig,
          )
          .catch(() => {
            // Handle unauthenticated
            return undefined
          }),

        api.products.list(
          {
            organizationId: organization.id,
            isArchived: false,
            isRecurring: true,
          },
          {
            ...cacheConfig,
            next: {
              ...cacheConfig.next,
              tags: [`products:${organization.id}:recurring`],
            },
          },
        ),

        // Optional Issue Loading
        issue_id
          ? api.issues.get({ id: issue_id }, cacheConfig)
          : Promise.resolve(undefined),
      ])

    listAdminOrganizations = loadListAdminOrganizations
    products = loadSubscriptionTiers
    issue = loadIssue
  } catch (e) {
    notFound()
  }

  if (!organization.public_page_enabled) {
    notFound()
  }

  // If issue and issue does not match org
  if (issue && issue.repository.organization.id !== organization.id) {
    notFound()
  }

  return (
    <ClientPage
      organization={organization}
      adminOrganizations={listAdminOrganizations?.items ?? []}
      products={products?.items ?? []}
      defaultAmount={parseInt(amount ?? '2000')}
      issue={issue}
    />
  )
}
