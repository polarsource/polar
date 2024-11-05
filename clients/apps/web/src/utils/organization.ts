import { Organization, PolarAPI } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getOrganizationBySlug = async (
  api: PolarAPI,
  slug: string,
): Promise<Organization | undefined> => {
  const data = await api.organizations.list(
    {
      slug,
    },
    {
      next: {
        tags: [`organizations:${slug}`],
        revalidate: 600,
      },
    },
  )
  return data.items[0]
}

// Tell React to memoize it for the duration of the request
export const getOrganizationBySlug = cache(_getOrganizationBySlug)

export const getOrganizationBySlugOrNotFound = async (
  api: PolarAPI,
  slug: string,
): Promise<Organization> => {
  const organization = await getOrganizationBySlug(api, slug)
  if (!organization) {
    notFound()
  }
  return organization
}
