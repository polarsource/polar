import { Client, schemas } from '@spaire/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getStorefront = async (
  api: Client,
  slug: string,
): Promise<schemas['Storefront'] | undefined> => {
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
): Promise<schemas['Storefront']> => {
  const storefront = await getStorefront(api, slug)
  if (!storefront) {
    notFound()
  }
  return storefront
}

const _getOrganizationSlugByProductId = async (
  api: Client,
  productId: string,
): Promise<schemas['OrganizationSlugLookup'] | undefined> => {
  const { data, error, response } = await api.GET(
    '/v1/storefronts/lookup/product/{product_id}',
    {
      params: {
        path: {
          product_id: productId,
        },
      },
      next: {
        revalidate: 600,
      },
    },
  )

  if (response.status === 404) {
    return undefined
  }

  if (error) {
    throw error
  }

  return data
}

export const getOrganizationSlugByProductId = cache(
  _getOrganizationSlugByProductId,
)

export const getOrganizationSlugByProductIdOrNotFound = async (
  api: Client,
  productId: string,
): Promise<schemas['OrganizationSlugLookup']> => {
  const lookup = await getOrganizationSlugByProductId(api, productId)
  if (!lookup) {
    notFound()
  }
  return lookup
}

const _getOrganizationSlugBySubscriptionId = async (
  api: Client,
  subscriptionId: string,
): Promise<schemas['OrganizationSlugLookup'] | undefined> => {
  const { data, error, response } = await api.GET(
    '/v1/storefronts/lookup/subscription/{subscription_id}',
    {
      params: {
        path: {
          subscription_id: subscriptionId,
        },
      },
      next: {
        revalidate: 600,
      },
    },
  )

  if (response.status === 404) {
    return undefined
  }

  if (error) {
    throw error
  }

  return data
}

export const getOrganizationSlugBySubscriptionId = cache(
  _getOrganizationSlugBySubscriptionId,
)

export const getOrganizationSlugBySubscriptionIdOrNotFound = async (
  api: Client,
  subscriptionId: string,
): Promise<schemas['OrganizationSlugLookup']> => {
  const lookup = await getOrganizationSlugBySubscriptionId(api, subscriptionId)
  if (!lookup) {
    notFound()
  }
  return lookup
}
