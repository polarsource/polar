import { schemas } from '@polar-sh/client'

export const isCustomerMembersEnabled = (
  organization: schemas['Organization'],
  customer: schemas['Customer'],
): boolean =>
  !!organization.feature_settings?.member_model_enabled &&
  customer.type === 'team'
