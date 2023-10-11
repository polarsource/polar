import {
  Issue,
  IssueReferenceRead,
  Organization,
  Pledge,
  PledgesTypeSummaries,
  Repository,
  Reward,
} from '@polar-sh/sdk'

export type IssueReadWithRelations = Issue & {
  references: IssueReferenceRead[]
  dependents: IssueReadWithRelations[]
  pledges: Pledge[]
  pledge_summary?: PledgesTypeSummaries
  rewards?: Reward[]

  // TODO: organization and repository can be removed, they are properties of issue
  organization: Organization
  repository: Repository
}
