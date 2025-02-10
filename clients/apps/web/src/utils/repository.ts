import { Client, operations, schemas, unwrap } from '@polar-sh/client'
import { getStorefront } from './storefront'

const getRepositoryBy = async (
  api: Client,
  parameters: Omit<
    NonNullable<operations['repositories:list']['parameters']['query']>,
    'page' | 'limit' | 'sorting'
  >,
  cacheOverrides?: any,
): Promise<schemas['Repository'] | undefined> => {
  const data = await unwrap(
    api.GET('/v1/repositories/', {
      params: {
        query: {
          ...parameters,
          limit: 1,
        },
      },
      ...cacheOverrides,
    }),
  )
  return data.items[0]
}

export const resolveRepositoryPath = async (
  api: Client,
  organizationSlug: string,
  repositoryName: string,
  cacheOverrides?: any,
): Promise<[schemas['Repository'], schemas['Organization']] | undefined> => {
  const storefront = await getStorefront(api, organizationSlug)

  // Existing Polar organization
  if (storefront) {
    const { organization } = storefront
    const repository = await getRepositoryBy(
      api,
      {
        organization_id: organization.id,
        name: repositoryName,
      },
      cacheOverrides,
    )

    if (repository) {
      return [repository, organization]
    }
  }

  // Not existing Polar organization or repository, try with an external organization
  const repository = await getRepositoryBy(
    api,
    {
      external_organization_name: organizationSlug,
      name: repositoryName,
    },
    cacheOverrides,
  )

  // Repository does not exist or not linked to a Polar organization
  if (!repository || !repository.internal_organization) {
    return undefined
  }

  return [repository, repository.internal_organization]
}
