import { InitOverrideFunction, Organization, PolarAPI } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getOrganizationBySlug = async (
  api: PolarAPI,
  slug: string,
  initOverrides?: RequestInit | InitOverrideFunction,
): Promise<Organization | undefined> => {
  const data = await api.organizations.list(
    {
      slug,
    },
    initOverrides,
  )
  return data.items?.[0]
}

// Tell React to memoize it for the duration of the request
export const getOrganizationBySlug = cache(_getOrganizationBySlug)

export const getOrganizationBySlugOrNotFound = async (
  api: PolarAPI,
  slug: string,
  initOverrides?: RequestInit | InitOverrideFunction,
): Promise<Organization> => {
  const organization = await getOrganizationBySlug(api, slug, initOverrides)
  if (!organization) {
    notFound()
  }
  return organization
}

const _getOrganizationById = async (
  api: PolarAPI,
  id: string,
  initOverrides?: RequestInit | InitOverrideFunction,
): Promise<Organization> => {
  return await api.organizations.get(
    {
      id,
    },
    initOverrides,
  )
}

// Tell React to memoize it for the duration of the request
export const getOrganizationById = cache(_getOrganizationById)
