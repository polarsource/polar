import {
  IssueDashboardRead,
  IssueReferenceRead,
  OrganizationPublicRead,
  PledgeRead,
  RepositoryRead,
} from './client'

export type IssueReadWithRelations = IssueDashboardRead & {
  references: IssueReferenceRead[]
  dependents: IssueReadWithRelations[]
  pledges: PledgeRead[]
  organization: OrganizationPublicRead
  repository: RepositoryRead
}
