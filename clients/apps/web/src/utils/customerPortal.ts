import { Client, schemas, unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getOrganizationOrNotFound = async (
  api: Client,
  slug: string,
): Promise<schemas['CustomerOrganization']> => {
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
    },
  )
}

// Tell React to memoize it for the duration of the request
export const getOrganizationOrNotFound = cache(_getOrganizationOrNotFound)
