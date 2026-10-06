import type { models } from '../../sdk'

export type CustomerIdentifier =
  | { customer_id: string }
  | { external_customer_id: string }

export type MemberIdentifier = CustomerIdentifier &
  (
    | { member_id: string; external_member_id?: never }
    | { external_member_id: string; member_id?: never }
    | { member_id?: never; external_member_id?: never }
  )

export type ActorSegment = NonNullable<
  models.EventMetadataInput['_actors']
>[number]
