import { schemas } from '@polar-sh/client'

export const isCustomerMembersEnabled = (
  _organization: schemas['Organization'],
  customer: schemas['Customer'],
): boolean => customer.type === 'team'
