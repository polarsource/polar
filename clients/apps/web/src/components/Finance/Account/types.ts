import { schemas } from '@polar-sh/client'

export type ReviewChecklistStep = Omit<
  schemas['OrganizationReviewCheck'],
  'key'
> & {
  key: schemas['OrganizationReviewCheckKey'] | 'identity'
  children?: ReviewChecklistStep[]
}
