import { Client, components, operations, unwrap } from '@polar-sh/client'
import { getStorefront } from './storefront'

const getIssueBy = async (
  api: Client,
  parameters: Omit<
    operations['issues:list']['parameters']['query'],
    'page' | 'limit' | 'sorting'
  >,
  cacheOverrides?: any,
): Promise<components['schemas']['Issue'] | undefined> => {
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
): Promise<
  | [components['schemas']['Issue'], components['schemas']['Organization']]
  | undefined
> => {
  const parsedIssueNumber = Number.parseInt(issueNumber, 10)

  const storefront = await getStorefront(api, organizationSlug)

  // Existing Polar organization
  if (storefront) {
    const { organization } = storefront
    const issue = await getIssueBy(
      api,
      {
        organizationId: organization.id,
        repositoryName,
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
      externalOrganizationName: organizationSlug,
      repositoryName,
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
