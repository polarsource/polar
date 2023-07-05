import {
  IssueDashboardRead,
  IssueReferenceRead,
  Organization,
  PledgeRead,
  RepositoryRead,
} from './client'

export type IssueReadWithRelations = IssueDashboardRead & {
  references: IssueReferenceRead[]
  dependents: IssueReadWithRelations[]
  pledges: PledgeRead[]
  organization: Organization
  repository: RepositoryRead
}
