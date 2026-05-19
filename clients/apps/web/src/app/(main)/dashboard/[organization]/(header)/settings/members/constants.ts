import { schemas } from '@polar-sh/client'

type OrganizationRole = schemas['OrganizationRole']

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

export const ROLE_ORDER: OrganizationRole[] = ['owner', 'admin', 'member']
