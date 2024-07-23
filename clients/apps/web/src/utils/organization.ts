import { InitOverrideFunction, Organization, PolarAPI } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'

export const getOrganizationBySlug = async (
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

export const getOrganizationById = async (
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
