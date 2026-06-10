import { useToast } from '@/components/Toast/use-toast'
import { useAuth } from '@/hooks/auth'
import { useUpdateOrganizationMemberRole } from '@/hooks/queries/org'
import { useOrganizationRoles } from '@/hooks/queries/roles'
import Check from '@mui/icons-material/Check'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import { useMemo, useState } from 'react'

import { ROLE_LABELS, ROLE_ORDER } from './constants'

type AssignableRole = 'admin' | 'member'

export function ChangeRoleModal({
  organizationId,
  member,
  onClose,
}: {
  organizationId: string
  member: schemas['OrganizationMember']
  onClose: () => void
}) {
  const { toast } = useToast()
  const { currentUser } = useAuth()
  const isCurrentUser = member.user_id === currentUser?.id
  // Owners can't reach this modal — the MembersPage row filters them out.
  const [role, setRole] = useState<AssignableRole>(
    member.role as AssignableRole,
  )
  const updateMemberRole = useUpdateOrganizationMemberRole(organizationId)
  const { data: roles } = useOrganizationRoles(organizationId)

  const orderedRoles = useMemo(
    () =>
      roles
        ? [...roles].sort(
            (a, b) => ROLE_ORDER.indexOf(a.id) - ROLE_ORDER.indexOf(b.id),
          )
        : [],
    [roles],
  )

  const allPermissions = useMemo(() => {
    if (!roles) return []
    const set = new Set<string>()
    for (const r of roles) {
      for (const p of r.permissions) set.add(p)
    }
    return Array.from(set).sort()
  }, [roles])

  const handleSave = async () => {
    if (role === member.role) {
      onClose()
      return
    }

    try {
      await updateMemberRole.mutateAsync({ userId: member.user_id, role })
      toast({
        title: 'Role updated',
        description: `${member.email} is now ${ROLE_LABELS[role]}.`,
      })
      onClose()
    } catch {
      toast({
        title: 'Failed to update role',
        description: 'Please try again.',
      })
    }
  }

  return (
    <Box display="flex" flexDirection="column" rowGap="xl" padding="2xl">
      <Text variant="heading-xxs" as="h3">
        Change Role
      </Text>
      <Text variant="caption" color="muted">
        {isCurrentUser ? (
          'Update your own role.'
        ) : (
          <>
            Update the role for{' '}
            <Text as="span" variant="label">
              {member.email}
            </Text>
            .
          </>
        )}
      </Text>
      <Select
        value={role}
        onValueChange={(value) => setRole(value as AssignableRole)}
      >
        <SelectTrigger>
          <SelectValue translate="no" />
        </SelectTrigger>
        <SelectContent translate="no">
          <SelectItem value="admin">
            <div>Admin</div>
          </SelectItem>
          <SelectItem value="member">
            <div>Member</div>
          </SelectItem>
        </SelectContent>
      </Select>
      {orderedRoles.length > 0 && (
        <Box
          maxHeight="30vh"
          overflowY="auto"
          borderRadius="m"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <table className="w-full text-sm">
            <thead className="dark:bg-polar-700 sticky top-0 bg-gray-50 text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Permission</th>
                {orderedRoles.map((r) => (
                  <th key={r.id} className="px-3 py-2 text-center font-medium">
                    {ROLE_LABELS[r.id]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allPermissions.map((permission) => (
                <tr
                  key={permission}
                  className="dark:border-polar-700 border-t border-gray-200"
                >
                  <td className="px-3 py-2">
                    <code className="text-xs">{permission}</code>
                  </td>
                  {orderedRoles.map((r) => (
                    <td key={r.id} className="px-3 py-2 text-center">
                      {r.permissions.includes(
                        permission as (typeof r.permissions)[number],
                      ) ? (
                        <Check
                          fontSize="small"
                          className="inline text-green-600 dark:text-green-400"
                        />
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}
      <Box display="flex" columnGap="s">
        <Button
          onClick={handleSave}
          disabled={updateMemberRole.isPending}
          loading={updateMemberRole.isPending}
        >
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </Box>
    </Box>
  )
}
