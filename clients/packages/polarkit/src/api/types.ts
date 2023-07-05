import {
  IssueDashboardRead,
  IssueReferenceRead,
  Organization,
  PledgeRead,
  Repository,
} from './client'

export type IssueReadWithRelations = IssueDashboardRead & {
  references: IssueReferenceRead[]
  dependents: IssueReadWithRelations[]
  pledges: PledgeRead[]
  organization: Organization
  repository: Repository
}
