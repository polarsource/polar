import { InitOverrideFunction, Organization, PolarAPI } from '@polar-sh/sdk'

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
