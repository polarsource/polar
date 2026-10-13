import { useHasPermission } from '@/hooks/permissions'
import { schemas } from '@polar-sh/client'

export const useCanAddCredits = (organization: schemas['Organization']) => {
  const canManageCustomers = useHasPermission(
    organization.id,
    'customers:manage',
  )
  return (
    canManageCustomers &&
    (organization.feature_settings?.config_as_code_enabled ?? false)
  )
}
