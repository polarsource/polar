import {
  Issue,
  IssueReferenceRead,
  Pledge,
  PledgesTypeSummaries,
  Reward,
} from '@polar-sh/sdk'

export type IssueReadWithRelations = Issue & {
  references: IssueReferenceRead[]
  dependents: IssueReadWithRelations[]
  pledges: Pledge[]
  pledge_summary?: PledgesTypeSummaries
  rewards?: Reward[]
}
