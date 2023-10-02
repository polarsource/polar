import {
  Issue,
  IssueReferenceRead,
  Organization,
  PledgeRead,
  Repository,
} from './client'

export type IssueReadWithRelations = Issue & {
  references: IssueReferenceRead[]
  dependents: IssueReadWithRelations[]
  pledges: PledgeRead[]

  // TODO: organization and repository can be removed, they are properties of issue
  organization: Organization
  repository: Repository
}
