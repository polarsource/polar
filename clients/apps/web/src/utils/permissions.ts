import { OrganizationPermission } from '@/hooks/queries/roles'

const GENERIC_DENIED_MESSAGE = "You don't have permission to view this."

// Mirrors `PERMISSION_DENIED_MESSAGE` in server/polar/auth/permission.py.
// Deliberately partial: permissions arrive from the API, so a backend deployed
// ahead of this build can name one that isn't here yet.
const MESSAGES: Partial<Record<OrganizationPermission, string>> = {
  'organization:manage':
    "You don't have permission to manage the organization.",
  'members:read': "You don't have permission to view members.",
  'members:manage': "You don't have permission to manage members.",
  'products:read': "You don't have permission to view products.",
  'products:manage': "You don't have permission to manage products.",
  'custom_fields:read': "You don't have permission to view custom fields.",
  'custom_fields:manage': "You don't have permission to manage custom fields.",
  'customers:read': "You don't have permission to view customers.",
  'customers:manage': "You don't have permission to manage customers.",
  'sales:read': "You don't have permission to view sales data.",
  'sales:manage': "You don't have permission to manage sales.",
  'analytics:read': "You don't have permission to view analytics.",
  'analytics:manage': "You don't have permission to manage analytics.",
  'events:ingest': "You don't have permission to ingest events.",
  'finance:read': "You don't have permission to access financial data.",
  'finance:manage': "You don't have permission to manage financial data.",
}

export const permissionDeniedMessage = (
  permission: OrganizationPermission,
): string => MESSAGES[permission] ?? GENERIC_DENIED_MESSAGE
