import { Client, schemas, unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getOrganizationBySlug = async (
  api: Client,
  slug: string,
  bypassCache: boolean = false,
): Promise<schemas['Organization'] | undefined> => {
  const params = {
    query: {
      slug,
    },
  }

  const data = bypassCache
    ? await unwrap(api.GET('/v1/organizations/', { params, cache: 'no-cache' }))
    : await unwrap(
        api.GET('/v1/organizations/', {
          params,
          next: {
            tags: [`organizations:${slug}`],
            revalidate: 600,
          },
        }),
      )
  return data.items[0]
}

// Tell React to memoize it for the duration of the request
const _getOrganizationBySlugCached = (api: Client, slug: string) =>
  _getOrganizationBySlug(api, slug, false)

export const getOrganizationBySlug = cache(_getOrganizationBySlugCached)

export const getOrganizationBySlugOrNotFound = async (
  api: Client,
  slug: string,
): Promise<schemas['Organization']> => {
  let organization = await getOrganizationBySlug(api, slug)

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
