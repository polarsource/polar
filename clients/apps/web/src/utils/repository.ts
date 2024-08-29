import {
  InitOverrideFunction,
  Organization,
  PolarAPI,
  RepositoriesApiListRequest,
  Repository,
} from '@polar-sh/sdk'
import { getOrganizationById, getOrganizationBySlug } from './organization'

const getRepositoryBy = async (
  api: PolarAPI,
  parameters: Omit<RepositoriesApiListRequest, 'page' | 'limit' | 'sorting'>,
  initOverrides?: RequestInit | InitOverrideFunction,
): Promise<Repository | undefined> => {
  const data = await api.repositories.list(
    {
      ...parameters,
      limit: 1,
    },
    initOverrides,
  )
  return data.items[0]
}

export const resolveRepositoryPath = async (
  api: PolarAPI,
  organizationSlug: string,
  repositoryName: string,
  initOverrides?: RequestInit | InitOverrideFunction,
): Promise<[Repository, Organization] | undefined> => {
  let organization = await getOrganizationBySlug(api, organizationSlug)

  // Existing Polar organization
  if (organization) {
    const repository = await getRepositoryBy(
      api,
      {
        organizationId: organization.id,
        name: repositoryName,
      },
      initOverrides,
    )

    if (repository) {
      return [repository, organization]
    }
  }

  // Not existing Polar organization or repository, try with an external organization
  const repository = await getRepositoryBy(
    api,
    {
      externalOrganizationName: organizationSlug,
      name: repositoryName,
    },
    initOverrides,
  )

  // Repository does not exist or not linked to a Polar organization
  if (!repository || !repository.organization.organization_id) {
    return undefined
  }

  // Retrieve the Polar organization
  organization = await getOrganizationById(
    api,
    repository.organization.organization_id,
  )

  if (!organization) {
    return undefined
  }

  return [repository, organization]
}
