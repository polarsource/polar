import {
  Issue,
  IssueReferenceRead,
  Organization,
  PledgeRead,
  PledgesTypeSummaries,
  Repository,
} from './client'

export type IssueReadWithRelations = Issue & {
  references: IssueReferenceRead[]
  dependents: IssueReadWithRelations[]
  pledges: PledgeRead[]
  pledge_summary?: PledgesTypeSummaries

  // TODO: organization and repository can be removed, they are properties of issue
  organization: Organization
  repository: Repository
}
