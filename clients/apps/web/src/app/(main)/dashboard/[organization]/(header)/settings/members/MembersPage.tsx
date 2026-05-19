'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Modal } from '@/components/Modal'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { useToast } from '@/components/Toast/use-toast'
import { useAuth } from '@/hooks/auth'
import { useHasPermission } from '@/hooks/permissions'
import {
  useInviteOrganizationMember,
  useLeaveOrganization,
  useListOrganizationMembers,
  useRemoveOrganizationMember,
  useUpdateOrganizationMemberRole,
} from '@/hooks/queries/org'
import { useOrganizationRoles } from '@/hooks/queries/roles'
import Add from '@mui/icons-material/Add'
import Check from '@mui/icons-material/Check'
import MoreVert from '@mui/icons-material/MoreVert'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

type OrganizationRole = schemas['OrganizationRole']

const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

const ROLE_ORDER: OrganizationRole[] = ['owner', 'admin', 'member']

export default function ClientPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const { currentUser } = useAuth()
  const { toast } = useToast()
  const { data: members, isLoading } = useListOrganizationMembers(
    organization.id,
  )
  const canManageMembers = useHasPermission(organization.id, 'members:manage')
  const {
    show: openInviteMemberModal,
    hide: hideInviteMemberModal,
    isShown: isInviteMemberModalShown,
  } = useModal()

  const [memberToRemove, setMemberToRemove] = useState<
    schemas['OrganizationMember'] | null
  >(null)
  const {
    show: showRemoveModal,
    hide: hideRemoveModal,
    isShown: isRemoveModalShown,
  } = useModal()

  const {
    show: showLeaveModal,
    hide: hideLeaveModal,
    isShown: isLeaveModalShown,
  } = useModal()

  const [memberToChangeRole, setMemberToChangeRole] = useState<
    schemas['OrganizationMember'] | null
  >(null)
  const {
    show: showChangeRoleModal,
    hide: hideChangeRoleModal,
    isShown: isChangeRoleModalShown,
  } = useModal()

  const removeMember = useRemoveOrganizationMember(organization.id)
  const leaveOrganization = useLeaveOrganization(organization.id)

  const handleRemoveMember = useCallback(
    (member: schemas['OrganizationMember']) => {
      setMemberToRemove(member)
      showRemoveModal()
    },
    [showRemoveModal],
  )

  const handleChangeRole = useCallback(
    (member: schemas['OrganizationMember']) => {
      setMemberToChangeRole(member)
      showChangeRoleModal()
    },
    [showChangeRoleModal],
  )

  const onConfirmRemove = useCallback(async () => {
    if (!memberToRemove) return

    try {
      await removeMember.mutateAsync(memberToRemove.user_id)
      toast({
        title: 'Member removed',
        description: `${memberToRemove.email} has been removed from the organization.`,
      })
    } catch {
      toast({
        title: 'Failed to remove member',
        description: 'Please try again.',
      })
    }
  }, [memberToRemove, removeMember, toast])

  const onConfirmLeave = useCallback(async () => {
    try {
      await leaveOrganization.mutateAsync()
      toast({
        title: 'Left organization',
        description: `You have left ${organization.name}.`,
      })
      router.push('/dashboard')
    } catch {
      toast({
        title: 'Failed to leave organization',
        description: 'Please try again.',
      })
    }
  }, [leaveOrganization, organization.name, router, toast])

  const columns: DataTableColumnDef<schemas['OrganizationMember']>[] = [
    {
      id: 'member',
      accessorKey: 'email',
      enableSorting: true,
      size: 300,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="User" />
      ),
      cell: ({ row: { original: member } }) => {
        const isCurrentUser = member.user_id === currentUser?.id
        return (
          <div className="flex flex-row items-center gap-2">
            <Avatar avatar_url={member.avatar_url} name={member.email} />
            <div className="fw-medium">{member.email}</div>
            <span className="dark:bg-polar-700 dark:text-polar-300 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {ROLE_LABELS[member.role]}
            </span>
            {isCurrentUser && (
              <span className="dark:bg-polar-700 dark:text-polar-300 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                You
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Joined on" />
      ),
      cell: ({ row: { original: member } }) => {
        return <FormattedDateTime datetime={member.created_at} />
      },
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row: { original: member } }) => {
        const isCurrentUser = member.user_id === currentUser?.id
        const isOwner = member.role === 'owner'

        if (isOwner) {
          return null
        }

        const canChangeRole = canManageMembers
        if (!canChangeRole && !isCurrentUser) {
          return null
        }

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon">
                  <MoreVert fontSize="small" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canChangeRole && (
                  <>
                    <DropdownMenuItem onClick={() => handleChangeRole(member)}>
                      Change role
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {isCurrentUser ? (
                  <DropdownMenuItem destructive onClick={showLeaveModal}>
                    Leave organization
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    destructive
                    onClick={() => handleRemoveMember(member)}
                  >
                    Remove from organization
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-sm)!"
      className="flex flex-col gap-y-8"
      header={
        canManageMembers ? (
          <Button onClick={openInviteMemberModal} variant="default">
            <Add className="mr-2" fontSize="small" />
            <span>Invite</span>
          </Button>
        ) : undefined
      }
    >
      <p className="dark:text-polar-500 text-gray-500">
        Manage users who have access to this organization.
      </p>

      {members && (
        <DataTable
          columns={columns}
          data={members.items}
          isLoading={isLoading}
        />
      )}

      <Modal
        title="Invite Member"
        className="max-w-(--breakpoint-sm)!"
        modalContent={
          <InviteMemberModal
            organizationId={organization.id}
            onClose={hideInviteMemberModal}
          />
        }
        isShown={isInviteMemberModalShown}
        hide={hideInviteMemberModal}
      />

      <ConfirmModal
        isShown={isRemoveModalShown}
        hide={hideRemoveModal}
        onConfirm={onConfirmRemove}
        title="Remove Member"
        description={`Are you sure you want to remove ${memberToRemove?.email} from this organization?`}
        destructive
        destructiveText="Remove"
      />

      <ConfirmModal
        isShown={isLeaveModalShown}
        hide={hideLeaveModal}
        onConfirm={onConfirmLeave}
        title="Leave Organization"
        description={`Are you sure you want to leave ${organization.name}? You will lose access to this organization.`}
        destructive
        destructiveText="Leave"
      />

      {memberToChangeRole && (
        <Modal
          title="Change Role"
          className="max-w-(--breakpoint-sm)!"
          modalContent={
            <ChangeRoleModal
              organizationId={organization.id}
              member={memberToChangeRole}
              onClose={hideChangeRoleModal}
            />
          }
          isShown={isChangeRoleModalShown}
          hide={hideChangeRoleModal}
        />
      )}
    </DashboardBody>
  )
}

function InviteMemberModal({
  organizationId,
  onClose,
}: {
  organizationId: string
  onClose: () => void
}) {
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const inviteMember = useInviteOrganizationMember(organizationId)

  const handleInvite = async () => {
    if (!email) return

    try {
      const result = await inviteMember.mutateAsync(email)
      if (result.response.status === 200) {
        toast({
          title: 'Member already added',
          description: 'User is already a member of this organization',
        })
      } else if (result.data) {
        toast({
          title: 'Member added',
          description: 'User successfully added to organization',
        })
        onClose()
      } else if (result.error) {
        toast({
          title: 'Invite failed',
          description: 'Failed to invite user. Please try again.',
        })
      }
    } catch {
      toast({
        title: 'Invite failed',
        description: 'Failed to invite user. Please try again.',
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleInvite()
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-y-6 p-8">
      <h3 className="text-lg font-medium">Invite User</h3>
      <Input
        type="email"
        placeholder="Enter email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!email || inviteMember.isPending}
          loading={inviteMember.isPending}
        >
          Send Invite
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function ChangeRoleModal({
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
  const initialRole: 'admin' | 'member' =
    member.role === 'admin' ? 'admin' : 'member'
  const [role, setRole] = useState<'admin' | 'member'>(initialRole)
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
    <div className="flex w-full flex-col gap-y-6 p-8">
      <h3 className="text-lg font-medium">Change Role</h3>
      <p className="dark:text-polar-500 text-sm text-gray-500">
        {isCurrentUser ? (
          'Update your own role.'
        ) : (
          <>
            Update the role for{' '}
            <span className="font-medium">{member.email}</span>.
          </>
        )}
      </p>
      <Select
        value={role}
        onValueChange={(value) => setRole(value as 'admin' | 'member')}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="member">Member</SelectItem>
        </SelectContent>
      </Select>
      {orderedRoles.length > 0 && (
        <div className="dark:border-polar-700 max-h-[30vh] overflow-y-auto rounded-md border border-gray-200">
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
        </div>
      )}
      <div className="flex gap-2">
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
      </div>
    </div>
  )
}
