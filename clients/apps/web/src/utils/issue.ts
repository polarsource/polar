import {
  InitOverrideFunction,
  Issue,
  IssuesApiListRequest,
  Organization,
  PolarAPI,
} from '@polar-sh/sdk'
import { getOrganizationById, getOrganizationBySlug } from './organization'

const getIssueBy = async (
  api: PolarAPI,
  parameters: Omit<IssuesApiListRequest, 'page' | 'limit' | 'sorting'>,
  initOverrides?: RequestInit | InitOverrideFunction,
): Promise<Issue | undefined> => {
  const data = await api.issues.list(
    {
      ...parameters,
      limit: 1,
    },
    initOverrides,
  )
  return data.items?.[0]
}

export const resolveIssuePath = async (
  api: PolarAPI,
  organizationSlug: string,
  repositoryName: string,
  issueNumber: string,
  initOverrides?: RequestInit | InitOverrideFunction,
): Promise<[Issue, Organization] | undefined> => {
  const parsedIssueNumber = Number.parseInt(issueNumber, 10)

  let organization = await getOrganizationBySlug(api, organizationSlug)
  // Existing Polar organization
  if (organization) {
    const issue = await getIssueBy(
      api,
      {
        organizationId: organization.id,
        repositoryName,
        number: parsedIssueNumber,
      },
      initOverrides,
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
    initOverrides,
  )

  // Issue does not exist or not linked to a Polar organization
  if (!issue || !issue.repository.organization.organization_id) {
    return undefined
  }

  // Retrieve the Polar organization
  organization = await getOrganizationById(
    api,
    issue.repository.organization.organization_id,
  )

  if (!organization) {
    return undefined
  }

  return [issue, organization]
}
