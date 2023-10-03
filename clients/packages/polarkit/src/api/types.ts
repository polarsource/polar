import {
  Issue,
  IssueReferenceRead,
  Organization,
  PledgeRead,
  PledgesTypeSummaries,
  Repository,
  Reward,
} from './client'

export type IssueReadWithRelations = Issue & {
  references: IssueReferenceRead[]
  dependents: IssueReadWithRelations[]
  pledges: PledgeRead[]
  pledge_summary?: PledgesTypeSummaries
  rewards?: Reward[]

  // TODO: organization and repository can be removed, they are properties of issue
  organization: Organization
  repository: Repository
}
