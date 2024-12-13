import { Organization, PolarAPI, ResponseError } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getOrganization = async (
  api: PolarAPI,
  slug: string,
): Promise<Organization | undefined> => {
  try {
    return await api.customerPortalOrganizations.get(
      {
        slug,
      },
      {
        next: {
          revalidate: 600,
          tags: [`organizations:${slug}`],
        },
      },
    )
  } catch (err) {
    if (err instanceof ResponseError && err.response.status === 404) {
      return undefined
    }
    throw err
  }
}

// Tell React to memoize it for the duration of the request
export const getOrganization = cache(_getOrganization)

export const getOrganizationOrNotFound = async (
  api: PolarAPI,
  slug: string,
): Promise<Organization> => {
  const organization = await getOrganization(api, slug)
  if (!organization) {
    notFound()
  }
  return organization
}
