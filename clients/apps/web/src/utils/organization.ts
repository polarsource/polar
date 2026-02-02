import { Client, schemas, unwrap } from '@spaire/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getOrganizationBySlug = async (
  api: Client,
  slug: string,
): Promise<schemas['Organization'] | undefined> => {
  const data = await unwrap(
    api.GET('/v1/organizations/', {
      params: {
        query: {
          slug,
        },
      },
      next: {
        tags: [`organizations:${slug}`],
        revalidate: 600,
      },
    }),
  )
  return data.items[0]
}

// Tell React to memoize it for the duration of the request
export const getOrganizationBySlug = cache(_getOrganizationBySlug)

export const getOrganizationBySlugOrNotFound = async (
  api: Client,
  slug: string,
): Promise<schemas['Organization']> => {
  const organization = await getOrganizationBySlug(api, slug)
  if (!organization) {
    notFound()
  }
  return organization
}
