import { Client, schemas, unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getOrganizationBySlug = async (
  api: Client,
  slug: string,
  cached: boolean,
): Promise<schemas['Organization'] | undefined> => {
  const requestOptions: Record<string, unknown> & {
    params: { query: { slug: string } }
  } = {
    params: {
      query: {
        slug,
      },
    },
  }

  if (cached) {
    requestOptions.next = {
      tags: [`organizations:${slug}`],
      revalidate: 600,
    }
  } else {
    requestOptions.cache = 'no-cache'
  }

  const data = await unwrap(api.GET('/v1/organizations/', requestOptions))
  return data.items[0]
}

// Tell React to memoize it for the duration of the request
const _getOrganizationBySlugCached = (
  api: Client,
  slug: string,
  cached: boolean = true,
) => _getOrganizationBySlug(api, slug, cached)

export const getOrganizationBySlug = cache(_getOrganizationBySlugCached)

export const getOrganizationBySlugOrNotFound = async (
  api: Client,
  slug: string,
  cached: boolean = true,
): Promise<schemas['Organization']> => {
  let organization = await getOrganizationBySlug(api, slug, cached)

  // If the organization is not found, refetch bypassing the cache
  // This avoids race conditions with new organizations (e.g. during onboarding)
  // without losing the cache in 99% of the cases
  if (!organization) {
    organization = await _getOrganizationBySlug(api, slug, true)
  }

  if (!organization) {
    notFound()
  }
  return organization
}
