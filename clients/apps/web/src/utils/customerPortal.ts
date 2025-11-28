import { Client, schemas, unwrap } from '@polar-sh/client'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

const _getOrganizationOrNotFound = async (
  api: Client,
  slug: string,
  searchParams?: Record<string, string>,
): Promise<schemas['CustomerOrganizationData']> => {
  return unwrap(
    api.GET('/v1/customer-portal/organizations/{slug}', {
      params: {
        path: {
          slug,
        },
      },
      next: {
        revalidate: 600,
        tags: [`organizations:${slug}`],
      },
    }),
    {
      404: notFound,
      429: () => redirect(`/too-many-requests`),
      401: () =>
        redirect(
          `/${slug}/portal/request?${new URLSearchParams(searchParams)}`,
        ),
    },
  )
}

// Tell React to memoize it for the duration of the request
export const getOrganizationOrNotFound = cache(_getOrganizationOrNotFound)
