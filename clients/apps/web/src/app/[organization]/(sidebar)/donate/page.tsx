import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlug } from '@/utils/organization'
import {
  Issue,
  ListResourceOrganization,
  ListResourceProduct,
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
  searchParams: { amount, issue_id },
}: {
  params: { organization: string }
  searchParams: { amount?: string; issue_id?: string }
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

  let listAdminOrganizations: ListResourceOrganization | undefined
  let products: ListResourceProduct | undefined
  let issue: Issue | undefined

  try {
    const [loadListAdminOrganizations, loadSubscriptionTiers, loadIssue] =
      await Promise.all([
        api.organizations
          .list(
            {
              isMember: true,
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
