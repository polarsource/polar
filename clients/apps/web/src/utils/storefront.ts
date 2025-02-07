import { Client, components } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getStorefront = async (
  api: Client,
  slug: string,
): Promise<components['schemas']['Storefront'] | undefined> => {
  const { data, error, response } = await api.GET('/v1/storefronts/{slug}', {
    params: {
      path: {
        slug,
      },
    },
    next: {
      revalidate: 600,
      tags: [`storefront:${slug}`],
    },
  })

  if (response.status === 404) {
    return undefined
  }

  if (error) {
    throw error
  }

  return data
}

// Tell React to memoize it for the duration of the request
export const getStorefront = cache(_getStorefront)

export const getStorefrontOrNotFound = async (
  api: Client,
  slug: string,
): Promise<components['schemas']['Storefront']> => {
  const storefront = await getStorefront(api, slug)
  if (!storefront) {
    notFound()
  }
  return storefront
}
