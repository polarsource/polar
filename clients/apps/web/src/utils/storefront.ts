import { PolarAPI, ResponseError, Storefront } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getStorefront = async (
  api: PolarAPI,
  slug: string,
): Promise<Storefront | undefined> => {
  try {
    return await api.storefronts.get(
      {
        slug,
      },
      {
        next: {
          revalidate: 600,
          tags: [`storefront:${slug}`],
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
export const getStorefront = cache(_getStorefront)

export const getStorefrontOrNotFound = async (
  api: PolarAPI,
  slug: string,
): Promise<Storefront> => {
  const storefront = await getStorefront(api, slug)
  if (!storefront) {
    notFound()
  }
  return storefront
}
