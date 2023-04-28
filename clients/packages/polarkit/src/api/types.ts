import {
  IssueDashboardRead,
  IssueReferenceRead,
  OrganizationRead,
  PledgeRead,
  RepositoryRead,
} from './client'

export type IssueReadWithRelations = IssueDashboardRead & {
  references: IssueReferenceRead[]
  dependents: IssueReadWithRelations[]
  pledges: PledgeRead[]
  organization: OrganizationRead
  repository: RepositoryRead
}
