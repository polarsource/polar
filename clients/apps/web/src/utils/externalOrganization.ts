import {
  ExternalOrganization,
  InitOverrideFunction,
  PolarAPI,
} from '@polar-sh/sdk'

export const getExternalOrganizationByName = async (
  api: PolarAPI,
  name: string,
  initOverrides?: RequestInit | InitOverrideFunction,
): Promise<ExternalOrganization | undefined> => {
  const data = await api.externalOrganizations.list(
    {
      name,
    },
    initOverrides,
  )
  return data.items?.[0]
}
