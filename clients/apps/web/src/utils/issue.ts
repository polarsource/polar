import { Client, operations, schemas, unwrap } from '@polar-sh/client'
import { getStorefront } from './storefront'

const getIssueBy = async (
  api: Client,
  parameters: Omit<
    NonNullable<operations['issues:list']['parameters']['query']>,
    'page' | 'limit' | 'sorting'
  >,
  cacheOverrides?: any,
): Promise<schemas['Issue'] | undefined> => {
  const data = await unwrap(
    api.GET('/v1/issues/', {
      params: {
        query: {
          limit: 1,
          ...parameters,
        },
      },
      ...cacheOverrides,
    }),
  )
  return data.items[0]
}

export const resolveIssuePath = async (
  api: Client,
  organizationSlug: string,
  repositoryName: string,
  issueNumber: string,
  cacheOverrides?: any,
): Promise<[schemas['Issue'], schemas['Organization']] | undefined> => {
  const parsedIssueNumber = Number.parseInt(issueNumber, 10)

  const storefront = await getStorefront(api, organizationSlug)

  // Existing Polar organization
  if (storefront) {
    const { organization } = storefront
    const issue = await getIssueBy(
      api,
      {
        organization_id: organization.id,
        repository_name: repositoryName,
        number: parsedIssueNumber,
      },
      cacheOverrides,
    )

    if (issue) {
      return [issue, organization]
    }
  }

  // Not existing Polar organization or issue, try with an external organization
  const issue = await getIssueBy(
    api,
    {
      external_organization_name: organizationSlug,
      repository_name: repositoryName,
      number: parsedIssueNumber,
    },
    cacheOverrides,
  )

  // Issue does not exist or not linked to a Polar organization
  if (!issue || !issue.repository.internal_organization) {
    return undefined
  }

  return [issue, issue.repository.internal_organization]
}
