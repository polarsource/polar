import { InitOverrideFunction, PolarAPI, Repository } from '@polar-sh/sdk'

export const getRepositoryByName = async (
  api: PolarAPI,
  organizationId: string,
  name: string,
  initOverrides?: RequestInit | InitOverrideFunction,
): Promise<Repository | undefined> => {
  const data = await api.repositories.list(
    {
      organizationId,
      name,
    },
    initOverrides,
  )
  return data.items?.[0]
}
